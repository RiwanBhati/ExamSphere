const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const controller = require('../controllers/broadcastController');

router.use(verifyToken, requireRole('ADMIN'));
router.get('/logs', controller.getLogs);
router.post('/emergency-room-change', controller.sendRoomChange);

module.exports = router;
