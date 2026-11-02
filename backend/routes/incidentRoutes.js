const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Submit UFM incident report (Faculty / Invigilator or Admin)
router.post('/ufm', requireRole('FACULTY', 'ADMIN'), incidentController.submitReport);

// Get list of incident reports (Admin gets all, query can filter by faculty for faculty portal)
router.get('/ufm', requireRole('FACULTY', 'ADMIN'), incidentController.getReports);

// Get incident summary statistics for dashboard
router.get('/stats', requireRole('ADMIN'), incidentController.getStats);

// Get specific incident report dossier
router.get('/ufm/:id', requireRole('ADMIN', 'FACULTY'), incidentController.getReportById);

// Manage incident record: update review status & disciplinary action (Admin only)
router.put('/ufm/:id/action', requireRole('ADMIN'), incidentController.updateReportAction);

// Delete incident record (Admin only)
router.delete('/ufm/:id', requireRole('ADMIN'), incidentController.deleteReport);

module.exports = router;
