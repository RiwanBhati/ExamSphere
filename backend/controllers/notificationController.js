const notificationService = require('../services/notificationService');

/**
 * Controller for Module 9: Notification & Alert System
 * Thin Controller Pattern strictly adhering to project architecture conventions.
 */

async function sendEmergencyBroadcast(req, res) {
  try {
    const result = await notificationService.sendEmergencyBroadcast({
      ...req.body,
      senderUserId: req.user?.id || null
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to dispatch emergency broadcast alert.'
    });
  }
}

async function getNotificationLogs(req, res) {
  try {
    const { search, recipient, type, status, limit, offset } = req.query;
    const result = await notificationService.getNotificationLogs({
      search,
      recipient,
      type,
      status,
      limit,
      offset
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to retrieve notification logs.'
    });
  }
}

async function getNotificationStats(req, res) {
  try {
    const data = await notificationService.getNotificationStats();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to compute notification statistics.'
    });
  }
}

async function sendStudentNotification(req, res) {
  try {
    const result = await notificationService.sendStudentSeatingNotification(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to dispatch student seating notification.'
    });
  }
}

async function sendFacultyNotification(req, res) {
  try {
    const result = await notificationService.sendFacultyDutyNotification(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to dispatch faculty duty notification.'
    });
  }
}

module.exports = {
  sendEmergencyBroadcast,
  getNotificationLogs,
  getNotificationStats,
  sendStudentNotification,
  sendFacultyNotification
};

