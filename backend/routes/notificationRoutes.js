const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

/**
 * Module 9: Notification & Alert System Routes
 * Endpoints for emergency broadcasts, delivery status logs, and candidate notifications
 */

// Module 9 - TC03: Send emergency broadcast alert to all exam attendees
router.post(
  '/broadcast',
  verifyToken,
  requireRole('ADMIN'),
  notificationController.sendEmergencyBroadcast
);

// Module 9 - TC04: Track and view notification delivery status in the log table
router.get(
  '/logs',
  verifyToken,
  requireRole('ADMIN', 'FACULTY'),
  notificationController.getNotificationLogs
);

// Summary statistics
router.get(
  '/stats',
  verifyToken,
  requireRole('ADMIN'),
  notificationController.getNotificationStats
);

// Module 9 - TC01: Student Seating Allotment Email
router.post(
  '/student',
  verifyToken,
  requireRole('ADMIN'),
  notificationController.sendStudentNotification
);

// Module 9 - TC02: Faculty Duty Assignment Notification
router.post(
  '/faculty',
  verifyToken,
  requireRole('ADMIN'),
  notificationController.sendFacultyNotification
);

module.exports = router;
