const { query } = require('../config/db');

// In-memory store for fallback/dev execution (clean slate, no demo records)
let inMemoryIncidents = [];

class IncidentService {
  /**
   * Submit an Unfair Means (UFM) report
   */
  async createReport(data) {
    // The login id belongs to `users`; ufm_reports.invigilator_id references
    // `faculty`. Resolve that relationship by email instead of trusting the
    // client-supplied id (which otherwise violates the foreign key).
    let facultyRecord = null;
    if (data.submitted_by_email) {
      try {
        const [facultyRows] = await query('SELECT id, name, department FROM faculty WHERE LOWER(email) = LOWER(?) LIMIT 1', [data.submitted_by_email]);
        facultyRecord = facultyRows?.[0] || null;
      } catch {}
    }
    const reportNumber = `UFM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const newRecord = {
      id: Date.now(),
      report_number: reportNumber,
      exam_id: Number(data.exam_id) || null,
      exam_name: data.exam_name || 'Semester Examination',
      course_code: data.course_code || '',
      student_id: Number(data.student_id) || null,
      student_name: data.student_name || 'Candidate',
      student_roll: data.student_roll || '',
      student_dept: data.student_dept || '',
      room_id: Number(data.room_id) || null,
      room_number: data.room_number || '',
      desk_number: data.desk_number || '',
      invigilator_id: facultyRecord?.id || (data.submitted_by_email ? null : (Number(data.invigilator_id) || null)),
      invigilator_name: facultyRecord?.name || data.submitted_by_name || data.invigilator_name || 'Invigilator',
      invigilator_department: facultyRecord?.department || data.invigilator_department || 'Faculty',
      submitted_by_email: data.submitted_by_email || null,
      incident_date: data.incident_date || new Date().toISOString().split('T')[0],
      incident_time: data.incident_time || '10:00 AM',
      incident_type: data.incident_type || 'UNAUTHORIZED_NOTES',
      severity: data.severity || 'MEDIUM',
      material_confiscated: data.material_confiscated || '',
      incident_details: data.incident_details || '',
      student_statement: data.student_statement || '',
      witness_name: data.witness_name || '',
      evidence_photo_url: data.evidence_photo_url || '',
      status: 'REPORTED',
      committee_remarks: '',
      penalty_imposed: '',
      resolved_by: '',
      resolved_at: null,
      created_at: new Date().toISOString()
    };

    // Persist reports so they are visible across faculty and admin sessions.
    try {
      const fullSql = `
        INSERT INTO ufm_reports (
          report_number, exam_id, exam_name, course_code, student_id, student_name,
          student_roll, student_dept, room_id, room_number, desk_number, invigilator_id,
          invigilator_name, invigilator_department, submitted_by_email, incident_date, incident_time,
          incident_type, severity, material_confiscated, incident_details,
          student_statement, witness_name, evidence_photo_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await query(fullSql, [
        newRecord.report_number, newRecord.exam_id, newRecord.exam_name, newRecord.course_code,
        newRecord.student_id, newRecord.student_name, newRecord.student_roll, newRecord.student_dept,
        newRecord.room_id, newRecord.room_number, newRecord.desk_number, newRecord.invigilator_id,
        newRecord.invigilator_name, newRecord.invigilator_department, newRecord.submitted_by_email, newRecord.incident_date, newRecord.incident_time,
        newRecord.incident_type, newRecord.severity, newRecord.material_confiscated, newRecord.incident_details,
        newRecord.student_statement, newRecord.witness_name, newRecord.evidence_photo_url, 'REPORTED'
      ]);
      if (result && result.insertId) {
        newRecord.id = result.insertId;
      }
    } catch (err) {
      // Keep local/demo mode usable while surfacing persistence failures in logs.
      console.warn('MySQL persistence note for UFM report:', err.message);
    }

    inMemoryIncidents.unshift(newRecord);
    return newRecord;
  }

  /**
   * Get all incident reports with optional filters
   */
  async getAllReports(filters = {}) {
    let results = [];
    try {
      let sql = 'SELECT * FROM ufm_reports WHERE 1=1';
      const params = [];

      if (filters.status && filters.status !== 'ALL') {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.severity && filters.severity !== 'ALL') {
        sql += ' AND severity = ?';
        params.push(filters.severity);
      }
      if (filters.incident_type && filters.incident_type !== 'ALL') {
        sql += ' AND incident_type = ?';
        params.push(filters.incident_type);
      }
      if (filters.search) {
        const q = `%${filters.search.toLowerCase()}%`;
        sql += ' AND (LOWER(report_number) LIKE ? OR LOWER(student_name) LIKE ? OR LOWER(student_roll) LIKE ? OR LOWER(exam_name) LIKE ? OR LOWER(room_number) LIKE ? OR LOWER(invigilator_name) LIKE ?)';
        params.push(q, q, q, q, q, q);
      }
      sql += ' ORDER BY id DESC';

      const [dbRows] = await query(sql, params);
      results = dbRows || [];
      // Include local demo submissions while the database is unavailable or
      // when the app is running in a mixed demo environment.
      const knownIds = new Set(results.map(row => String(row.id)));
      results = [...results, ...inMemoryIncidents.filter(row => !knownIds.has(String(row.id)))];
    } catch (e) {
      // Fallback to in-memory store if DB query fails
      results = [...inMemoryIncidents];
      if (filters.status && filters.status !== 'ALL') {
        results = results.filter(r => r.status === filters.status);
      }
      if (filters.severity && filters.severity !== 'ALL') {
        results = results.filter(r => r.severity === filters.severity);
      }
      if (filters.incident_type && filters.incident_type !== 'ALL') {
        results = results.filter(r => r.incident_type === filters.incident_type);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(r => 
          (r.report_number && r.report_number.toLowerCase().includes(q)) ||
          (r.student_name && r.student_name.toLowerCase().includes(q)) ||
          (r.student_roll && r.student_roll.toLowerCase().includes(q)) ||
          (r.exam_name && r.exam_name.toLowerCase().includes(q)) ||
          (r.room_number && r.room_number.toLowerCase().includes(q)) ||
          (r.invigilator_name && r.invigilator_name.toLowerCase().includes(q))
        );
      }
    }

    return results;
  }

  /**
   * Get reports submitted by a specific faculty member (For Faculty Portal)
   */
  async getReportsByFaculty(facultyName, facultyId, facultyEmail) {
    const all = await this.getAllReports();
    return all.filter(r => {
      if (facultyEmail && r.submitted_by_email && r.submitted_by_email.toLowerCase() === facultyEmail.toLowerCase()) return true;
      if (facultyId && Number(r.invigilator_id) === Number(facultyId)) return true;
      if (facultyName && r.invigilator_name && r.invigilator_name.toLowerCase().includes(facultyName.toLowerCase())) return true;
      return false;
    });
  }

  /**
   * Get single report by ID
   */
  async getReportById(id) {
    try {
      const [rows] = await query('SELECT * FROM ufm_reports WHERE id = ?', [id]);
      if (rows.length > 0) return rows[0];
    } catch {}

    const report = inMemoryIncidents.find(r => Number(r.id) === Number(id));
    if (!report) {
      const err = new Error(`Incident report with ID ${id} not found.`);
      err.statusCode = 404;
      throw err;
    }
    return report;
  }

  /**
   * Manage incident record: update review status, penalty, and committee remarks (Admin Only)
   */
  async updateReportAction(id, { status, committee_remarks, penalty_imposed, resolved_by }) {
    const index = inMemoryIncidents.findIndex(r => Number(r.id) === Number(id));
    if (index !== -1) {
      inMemoryIncidents[index] = {
        ...inMemoryIncidents[index],
        status: status || inMemoryIncidents[index].status,
        committee_remarks: committee_remarks !== undefined ? committee_remarks : inMemoryIncidents[index].committee_remarks,
        penalty_imposed: penalty_imposed !== undefined ? penalty_imposed : inMemoryIncidents[index].penalty_imposed,
        resolved_by: resolved_by || 'Disciplinary Committee / Exam Controller',
        resolved_at: status === 'ACTION_TAKEN' || status === 'DISMISSED' ? new Date().toISOString() : inMemoryIncidents[index].resolved_at
      };
    }

    // Try updating MySQL if available
    try {
      await query(
        `UPDATE ufm_reports SET status = ?, committee_remarks = ?, penalty_imposed = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`,
        [status, committee_remarks || null, penalty_imposed || null, resolved_by || 'Disciplinary Committee', new Date(), id]
      );
    } catch (err) {
      // Legacy fallback
      try {
        await query(
          `UPDATE ufm_reports SET status = ?, student_statement = ? WHERE id = ?`,
          [status, committee_remarks, id]
        );
      } catch (legacyErr) {
        console.warn('MySQL update note for UFM report:', legacyErr.message);
      }
    }

    return this.getReportById(id);
  }

  /**
   * Aggregate incident statistics for Administrator Dashboard
   */
  async getIncidentStats() {
    const reports = await this.getAllReports();
    const total = reports.length;
    const reported = reports.filter(r => r.status === 'REPORTED').length;
    const underReview = reports.filter(r => r.status === 'UNDER_REVIEW').length;
    const actionTaken = reports.filter(r => r.status === 'ACTION_TAKEN').length;
    const dismissed = reports.filter(r => r.status === 'DISMISSED').length;
    const criticalCount = reports.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH').length;

    // Room hotspots
    const roomCounts = {};
    reports.forEach(r => {
      if (r.room_number) {
        roomCounts[r.room_number] = (roomCounts[r.room_number] || 0) + 1;
      }
    });

    // Infraction category counts
    const categoryCounts = {};
    reports.forEach(r => {
      if (r.incident_type) {
        categoryCounts[r.incident_type] = (categoryCounts[r.incident_type] || 0) + 1;
      }
    });

    return {
      total,
      reported,
      underReview,
      actionTaken,
      dismissed,
      criticalCount,
      roomCounts,
      categoryCounts
    };
  }

  /**
   * Delete incident record (Admin only)
   */
  async deleteReport(id) {
    inMemoryIncidents = inMemoryIncidents.filter(r => Number(r.id) !== Number(id));
    try {
      await query('DELETE FROM ufm_reports WHERE id = ?', [id]);
    } catch (err) {
      console.warn('MySQL delete note for UFM report:', err.message);
    }
    return { success: true, message: `Report ${id} deleted.` };
  }
}

module.exports = new IncidentService();
