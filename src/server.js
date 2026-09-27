require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.warn('Warning: DATABASE_URL and JWT_SECRET must be set before using protected/database endpoints.');
}

app.listen(PORT, () => {
  console.log(`EVE Healthcare backend running on http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
});
