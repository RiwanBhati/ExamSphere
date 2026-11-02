const incidentService = require('../services/incidentService');

/**
 * Controller for Exam-Day Incident Management (Module 8)
 */
async function submitReport(req, res, next) {
  try {
    const report = await incidentService.createReport({
      ...req.body,
      submitted_by_email: req.user?.email || null,
      submitted_by_name: req.user?.name || null
    });
    return res.status(201).json({
      success: true,
      message: `Unfair Means (UFM) report ${report.report_number} successfully submitted.`,
      data: report
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
}

async function getReports(req, res, next) {
  try {
    const { status, severity, incident_type, search, facultyName, facultyId } = req.query;
    if (req.user?.role === 'FACULTY') {
      const facultyReports = await incidentService.getReportsByFaculty(req.user.name, req.user.faculty_id, req.user.email);
      return res.status(200).json({ success: true, data: facultyReports });
    }
    
    // If faculty query specified, filter for faculty
    if (facultyName || facultyId) {
      const facultyReports = await incidentService.getReportsByFaculty(facultyName, facultyId);
      return res.status(200).json({
        success: true,
        data: facultyReports
      });
    }

    const reports = await incidentService.getAllReports({
      status,
      severity,
      incident_type,
      search
    });

    return res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
}

async function getReportById(req, res, next) {
  try {
    const report = await incidentService.getReportById(req.params.id);
    if (req.user?.role === 'FACULTY') {
      const ownsReport = (report.submitted_by_email && report.submitted_by_email.toLowerCase() === String(req.user.email || '').toLowerCase()) ||
        (req.user.faculty_id && Number(report.invigilator_id) === Number(req.user.faculty_id));
      if (!ownsReport) return res.status(403).json({ success: false, message: 'You can only view reports submitted by your account.' });
    }
    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
}

async function updateReportAction(req, res, next) {
  try {
    const updated = await incidentService.updateReportAction(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: `Disciplinary decision for ${updated.report_number} successfully recorded.`,
      data: updated
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
}

async function getStats(req, res, next) {
  try {
    const stats = await incidentService.getIncidentStats();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
}

async function deleteReport(req, res, next) {
  try {
    const result = await incidentService.deleteReport(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  submitReport,
  getReports,
  getReportById,
  updateReportAction,
  getStats,
  deleteReport
};
