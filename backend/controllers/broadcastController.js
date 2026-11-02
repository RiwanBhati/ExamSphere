const broadcastService = require('../services/broadcastService');

async function sendRoomChange(req, res) {
  try {
    const data = await broadcastService.sendRoomChange({ ...req.body, senderEmail: req.user?.email });
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function getLogs(req, res) {
  try {
    const data = await broadcastService.getLogs();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { sendRoomChange, getLogs };
