const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, '../../sql/schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(__dirname, '../../sql/seed.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(seed);
  console.log('Database schema and seed data are ready.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Database setup failed:', err.message);
  await pool.end();
  process.exit(1);
});
