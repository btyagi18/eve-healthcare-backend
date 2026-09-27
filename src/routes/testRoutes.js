const router = require('express').Router();
const auth = require('../middleware/auth');
const { listTests, createTest, updateTest } = require('../controllers/testController');
router.get('/', listTests);
router.post('/', auth, createTest);
router.patch('/:id', auth, updateTest);
module.exports = router;
