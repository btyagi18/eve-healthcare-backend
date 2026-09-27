const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function validateSignup({ name, email, password }) {
  if (!name || !email || !password) return 'name, email and password are required.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'A valid email is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};
    const validationError = validateSignup({ name, email, password });
    if (validationError) return res.status(400).json({ message: validationError });

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount) return res.status(409).json({ message: 'Email is already registered.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), normalizedEmail, passwordHash]
    );
    return res.status(201).json({ message: 'User created successfully.', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email is already registered.' });
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'email and password are required.' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!result.rowCount) return res.status(401).json({ message: 'Invalid email or password.' });

    const user = result.rows[0];
    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    return res.json({ message: 'Login successful.', token });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login };
