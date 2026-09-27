const pool = require('../config/db');

async function listCentres(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.location, c.created_at,
             COALESCE(json_agg(
               json_build_object('centreTestId', ct.id, 'testId', t.id, 'testName', t.name, 'description', t.description, 'price', ct.price)
               ORDER BY t.name
             ) FILTER (WHERE ct.id IS NOT NULL), '[]') AS tests
      FROM diagnostic_centres c
      LEFT JOIN centre_tests ct ON ct.centre_id = c.id
      LEFT JOIN tests t ON t.id = ct.test_id
      GROUP BY c.id
      ORDER BY c.id`);
    res.json({ centres: result.rows });
  } catch (err) { next(err); }
}

async function getCentre(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.location, c.created_at,
             COALESCE(json_agg(
               json_build_object('centreTestId', ct.id, 'testId', t.id, 'testName', t.name, 'description', t.description, 'price', ct.price)
               ORDER BY t.name
             ) FILTER (WHERE ct.id IS NOT NULL), '[]') AS tests
      FROM diagnostic_centres c
      LEFT JOIN centre_tests ct ON ct.centre_id = c.id
      LEFT JOIN tests t ON t.id = ct.test_id
      WHERE c.id = $1
      GROUP BY c.id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Diagnostic centre not found.' });
    res.json({ centre: result.rows[0] });
  } catch (err) { next(err); }
}

async function createCentre(req, res, next) {
  try {
    const { name, location } = req.body || {};
    if (!name || !location || !name.trim() || !location.trim()) {
      return res.status(400).json({ message: 'name and location are required.' });
    }
    const result = await pool.query(
      'INSERT INTO diagnostic_centres (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at',
      [name.trim(), location.trim()]
    );
    res.status(201).json({ centre: result.rows[0] });
  } catch (err) { next(err); }
}

async function updateCentre(req, res, next) {
  try {
    const { name, location } = req.body || {};
    if (!name && !location) return res.status(400).json({ message: 'Provide name or location to update.' });
    const result = await pool.query(
      `UPDATE diagnostic_centres
       SET name = COALESCE($1, name), location = COALESCE($2, location)
       WHERE id = $3
       RETURNING id, name, location, created_at`,
      [name?.trim() || null, location?.trim() || null, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Diagnostic centre not found.' });
    res.json({ centre: result.rows[0] });
  } catch (err) { next(err); }
}

async function listCentreTests(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT ct.id AS centre_test_id, t.id AS test_id, t.name AS test_name,
              t.description, c.id AS centre_id, c.name AS centre_name,
              c.location, ct.price
       FROM centre_tests ct
       JOIN tests t ON t.id = ct.test_id
       JOIN diagnostic_centres c ON c.id = ct.centre_id
       WHERE c.id = $1
       ORDER BY t.name`,
      [req.params.id]
    );
    if (!result.rowCount) {
      const centre = await pool.query('SELECT id FROM diagnostic_centres WHERE id = $1', [req.params.id]);
      if (!centre.rowCount) return res.status(404).json({ message: 'Diagnostic centre not found.' });
    }
    res.json({ tests: result.rows });
  } catch (err) { next(err); }
}

async function addCentreTest(req, res, next) {
  try {
    const { testId, price } = req.body || {};
    if (!testId || price === undefined || price === null) {
      return res.status(400).json({ message: 'testId and price are required.' });
    }
    if (Number.isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ message: 'price must be a non-negative number.' });
    }
    const centre = await pool.query('SELECT id FROM diagnostic_centres WHERE id = $1', [req.params.id]);
    if (!centre.rowCount) return res.status(404).json({ message: 'Diagnostic centre not found.' });
    const test = await pool.query('SELECT id FROM tests WHERE id = $1', [testId]);
    if (!test.rowCount) return res.status(404).json({ message: 'Diagnostic test not found.' });
    try {
      const result = await pool.query(
        `INSERT INTO centre_tests (centre_id, test_id, price)
         VALUES ($1, $2, $3)
         RETURNING id AS centre_test_id, centre_id, test_id, price`,
        [req.params.id, testId, price]
      );
      res.status(201).json({ centreTest: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'This test is already offered by the centre.' });
      throw err;
    }
  } catch (err) { next(err); }
}

async function updateCentreTest(req, res, next) {
  try {
    const { price } = req.body || {};
    if (price === undefined || Number.isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ message: 'price must be a non-negative number.' });
    }
    const result = await pool.query(
      `UPDATE centre_tests SET price = $1 WHERE id = $2
       RETURNING id AS centre_test_id, centre_id, test_id, price`,
      [price, req.params.centreTestId]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Centre-test mapping not found.' });
    res.json({ centreTest: result.rows[0] });
  } catch (err) { next(err); }
}

module.exports = { listCentres, getCentre, createCentre, updateCentre, listCentreTests, addCentreTest, updateCentreTest };
