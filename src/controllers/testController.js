const pool = require('../config/db');

async function listTests(req, res, next) {
  try {
    const result = await pool.query('SELECT id, name, description, created_at FROM tests ORDER BY id');
    res.json({ tests: result.rows });
  } catch (err) { next(err); }
}

async function createTest(req, res, next) {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required.' });
    const result = await pool.query(
      'INSERT INTO tests (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
      [name.trim(), description?.trim() || null]
    );
    res.status(201).json({ test: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Test already exists.' });
    next(err);
  }
}

async function updateTest(req, res, next) {
  try {
    const { name, description } = req.body || {};
    if (name === undefined && description === undefined) {
      return res.status(400).json({ message: 'Provide name or description to update.' });
    }
    const result = await pool.query(
      `UPDATE tests
       SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3
       RETURNING id, name, description, created_at`,
      [name?.trim() || null, description?.trim() || null, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Diagnostic test not found.' });
    res.json({ test: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Test already exists.' });
    next(err);
  }
}

module.exports = { listTests, createTest, updateTest };
