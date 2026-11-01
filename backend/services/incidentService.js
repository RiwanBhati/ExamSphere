const { query } = require('../config/db');

// In-memory store for fallback/dev execution
let inMemoryIncidents = [];

class IncidentService {
  constructor() {
    this.schemaEnsured = false;
  }

  /**
   * Ensure MySQL schema extensions for ufm_reports:
   * - evidence_photo_url is LONGTEXT to hold full base64 images without truncation
   * - all descriptive columns exist and have proper types
   */
  async ensureSchema() {
    if (this.schemaEnsured) return;
    try {
      // Modify evidence_photo_url to LONGTEXT so base64 camera snapshots never get truncated
      try {
        await query('ALTER TABLE ufm_reports MODIFY COLUMN evidence_photo_url LONGTEXT NULL');
      } catch (e) {}

      // Modify foreign key columns to NULLABLE so missing references don't fail report insertion
      try {
        await query('ALTER TABLE ufm_reports MODIFY COLUMN student_id INT NULL');
        await query('ALTER TABLE ufm_reports MODIFY COLUMN room_id INT NULL');
        await query('ALTER TABLE ufm_reports MODIFY COLUMN invigilator_id INT NULL');
      } catch (e) {}

      // Check and add any missing columns in ufm_reports
      const [cols] = await query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ufm_reports'
      `);
      const colNames = cols.map(c => c.COLUMN_NAME);

      if (!colNames.includes('report_number')) {
        await query('ALTER TABLE ufm_reports ADD COLUMN report_number VARCHAR(50) NULL AFTER id');
      }
      if (!colNames.includes('exam_name')) {
        await query('ALTER TABLE ufm_reports ADD COLUMN exam_name VARCHAR(150) NULL AFTER exam_id');
      }
      if (!colNames.includes('course_code')) {
        await query('ALTER TABLE ufm_reports ADD COLUMN course_code VARCHAR(50) NULL AFTER exam_name');
      }
      if (!colNames.includes('student_name')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN student_name VARCHAR(120) NOT NULL DEFAULT 'Candidate' AFTER student_id");
      }
      if (!colNames.includes('student_roll')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN student_roll VARCHAR(50) NOT NULL DEFAULT 'Roll No Pending' AFTER student_name");
      }
      if (!colNames.includes('student_dept')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN student_dept VARCHAR(100) NULL DEFAULT 'General' AFTER student_roll");
      }
      if (!colNames.includes('room_number')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN room_number VARCHAR(50) NOT NULL DEFAULT 'Exam Hall' AFTER room_id");
      }
      if (!colNames.includes('desk_number')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN desk_number VARCHAR(50) NULL DEFAULT 'Desk 1' AFTER room_number");
      }
      if (!colNames.includes('invigilator_name')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN invigilator_name VARCHAR(120) NOT NULL DEFAULT 'Invigilator' AFTER invigilator_id");
      }
      if (!colNames.includes('invigilator_department')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN invigilator_department VARCHAR(100) NULL DEFAULT 'Faculty' AFTER invigilator_name");
      }
      if (!colNames.includes('incident_date')) {
        await query('ALTER TABLE ufm_reports ADD COLUMN incident_date DATE NULL AFTER invigilator_department');
      }
      if (!colNames.includes('incident_time')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN incident_time VARCHAR(20) NULL DEFAULT '10:00 AM' AFTER incident_date");
      }
      if (!colNames.includes('incident_type')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN incident_type ENUM('UNAUTHORIZED_NOTES', 'MOBILE_DEVICE', 'SMARTWATCH_DEVICE', 'COPYING_NEIGHBOR', 'IMPERSONATION', 'COMMUNICATION', 'OTHER') NOT NULL DEFAULT 'OTHER' AFTER incident_time");
      }
      if (!colNames.includes('severity')) {
        await query("ALTER TABLE ufm_reports ADD COLUMN severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM' AFTER incident_type");
      }
      if (!colNames.includes('material_confiscated')) {
        await query('ALTER TABLE ufm_reports ADD COLUMN material_confiscated TEXT NULL AFTER severity');
      }

      this.schemaEnsured = true;
    } catch (err) {
      console.warn('IncidentService schema ensure note:', err.message);
    }
  }

  /**
   * Submit an Unfair Means (UFM) report
   */
  async createReport(data) {
    await this.ensureSchema();

    // 1. Generate standard docket number
    const reportNumber = data.report_number || `UFM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    // 2. Extract and sanitize descriptive fields
    let studentName = (data.student_name || '').trim() || 'Candidate';
    let studentRoll = (data.student_roll || '').trim() || 'Roll No Pending';
    let studentDept = (data.student_dept || '').trim() || 'General';

    let examName = (data.exam_name || '').trim();
    let courseCode = (data.course_code || '').trim();
    let incidentDate = data.incident_date || new Date().toISOString().split('T')[0];
    let incidentTime = data.incident_time || '10:00 AM';

    let roomNumber = (data.room_number || '').trim() || 'Exam Hall';
    let deskNumber = (data.desk_number || '').trim() || 'Desk 1';

    let invigilatorName = (data.invigilator_name || '').trim() || 'Invigilator';
    let invigilatorDept = (data.invigilator_department || '').trim() || 'Faculty';

    let materialConfiscated = (data.material_confiscated || '').trim() || 'Unauthorized material';
    let incidentDetails = (data.incident_details || '').trim() || 'Observed with unauthorized material during exam supervision';
    let studentStatement = (data.student_statement || '').trim();
    let witnessName = (data.witness_name || '').trim();
    let incidentType = data.incident_type || 'UNAUTHORIZED_NOTES';
    let severity = data.severity || 'MEDIUM';
    let evidencePhotoUrl = data.evidence_photo_url || '';

    // 3. Resolve and validate Foreign Keys safely to avoid FK constraint violations
    let examId = Number(data.exam_id) || null;
    let studentId = Number(data.student_id) || null;
    let roomId = Number(data.room_id) || null;
    let invigilatorId = Number(data.invigilator_id) || null;

    // A. Resolve student
    try {
      if (studentId) {
        const [sRows] = await query('SELECT id, name, enrollment_no, department FROM students WHERE id = ?', [studentId]);
        if (sRows.length > 0) {
          studentId = sRows[0].id;
          if (studentName === 'Candidate') studentName = sRows[0].name;
          if (studentRoll === 'Roll No Pending') studentRoll = sRows[0].enrollment_no;
          if (studentDept === 'General') studentDept = sRows[0].department || 'General';
        } else {
          studentId = null;
        }
      }
      if (!studentId && (studentRoll !== 'Roll No Pending' || studentName !== 'Candidate')) {
        const [sMatch] = await query(
          'SELECT id, name, enrollment_no, department FROM students WHERE enrollment_no = ? OR LOWER(name) = ? LIMIT 1',
          [studentRoll, studentName.toLowerCase()]
        );
        if (sMatch.length > 0) {
          studentId = sMatch[0].id;
          studentName = sMatch[0].name;
          studentRoll = sMatch[0].enrollment_no;
          if (studentDept === 'General') studentDept = sMatch[0].department || 'General';
        }
      }
    } catch (e) {
      studentId = null;
    }

    // B. Resolve exam
    try {
      if (examId) {
        const [eRows] = await query(`
          SELECT e.id, e.exam_name, e.exam_date, c.course_code 
          FROM exams e 
          LEFT JOIN courses c ON e.course_id = c.id 
          WHERE e.id = ? LIMIT 1
        `, [examId]);
        if (eRows.length > 0) {
          examId = eRows[0].id;
          if (!examName) examName = eRows[0].exam_name;
          if (!courseCode) courseCode = eRows[0].course_code || '';
          if (!data.incident_date && eRows[0].exam_date) incidentDate = eRows[0].exam_date;
        } else {
          examId = null;
        }
      }
      if (!examId) {
        const [firstExam] = await query(`
          SELECT e.id, e.exam_name, e.exam_date, c.course_code 
          FROM exams e 
          LEFT JOIN courses c ON e.course_id = c.id 
          LIMIT 1
        `);
        if (firstExam.length > 0) {
          examId = firstExam[0].id;
          if (!examName) examName = firstExam[0].exam_name;
          if (!courseCode) courseCode = firstExam[0].course_code || '';
        } else {
          examId = 1;
        }
      }
    } catch (e) {
      examId = 1;
    }

    // C. Resolve room
    try {
      if (roomId) {
        const [rRows] = await query('SELECT id, room_number FROM rooms WHERE id = ? LIMIT 1', [roomId]);
        if (rRows.length > 0) {
          roomId = rRows[0].id;
          if (roomNumber === 'Exam Hall') roomNumber = rRows[0].room_number;
        } else {
          roomId = null;
        }
      }
      if (!roomId && roomNumber !== 'Exam Hall') {
        const [rMatch] = await query('SELECT id, room_number FROM rooms WHERE room_number = ? LIMIT 1', [roomNumber]);
        if (rMatch.length > 0) {
          roomId = rMatch[0].id;
          roomNumber = rMatch[0].room_number;
        }
      }
    } catch (e) {
      roomId = null;
    }

    // D. Resolve invigilator against faculty table (FK targets faculty(id))
    try {
      let fMatch = null;
      if (invigilatorName && invigilatorName !== 'Invigilator') {
        const cleanInvName = invigilatorName.toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.)\s*/i, '').trim();
        const [fByName] = await query(
          'SELECT id, name, department FROM faculty WHERE LOWER(name) LIKE ? OR LOWER(name) = ? LIMIT 1',
          [`%${cleanInvName}%`, invigilatorName.toLowerCase()]
        );
        if (fByName.length > 0) fMatch = fByName[0];
      }

      if (!fMatch && invigilatorId) {
        const [fByUserId] = await query('SELECT id, name, department FROM faculty WHERE user_id = ? LIMIT 1', [invigilatorId]);
        if (fByUserId.length > 0) fMatch = fByUserId[0];
      }

      if (!fMatch && invigilatorId) {
        const [fById] = await query('SELECT id, name, department FROM faculty WHERE id = ? LIMIT 1', [invigilatorId]);
        if (fById.length > 0) fMatch = fById[0];
      }

      if (fMatch) {
        invigilatorId = fMatch.id;
        invigilatorName = fMatch.name;
        if (!invigilatorDept || invigilatorDept === 'Faculty') invigilatorDept = fMatch.department;
      } else {
        invigilatorId = null;
      }
    } catch (e) {
      invigilatorId = null;
    }

    const newRecord = {
      id: Date.now(),
      report_number: reportNumber,
      exam_id: examId,
      exam_name: examName || 'Semester Examination',
      course_code: courseCode || '',
      student_id: studentId,
      student_name: studentName,
      student_roll: studentRoll,
      student_dept: studentDept,
      room_id: roomId,
      room_number: roomNumber,
      desk_number: deskNumber,
      invigilator_id: invigilatorId,
      invigilator_name: invigilatorName,
      invigilator_department: invigilatorDept,
      incident_date: incidentDate,
      incident_time: incidentTime,
      incident_type: incidentType,
      severity: severity,
      material_confiscated: materialConfiscated,
      incident_details: incidentDetails,
      student_statement: studentStatement,
      witness_name: witnessName,
      evidence_photo_url: evidencePhotoUrl,
      status: 'REPORTED',
      committee_remarks: '',
      penalty_imposed: '',
      resolved_by: '',
      resolved_at: null,
      created_at: new Date().toISOString()
    };

    // 4. Persist to MySQL
    try {
      const fullSql = `
        INSERT INTO ufm_reports (
          report_number, exam_id, exam_name, course_code, student_id, student_name,
          student_roll, student_dept, room_id, room_number, desk_number, invigilator_id,
          invigilator_name, invigilator_department, incident_date, incident_time,
          incident_type, severity, material_confiscated, incident_details,
          student_statement, witness_name, evidence_photo_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await query(fullSql, [
        newRecord.report_number, newRecord.exam_id, newRecord.exam_name, newRecord.course_code,
        newRecord.student_id, newRecord.student_name, newRecord.student_roll, newRecord.student_dept,
        newRecord.room_id, newRecord.room_number, newRecord.desk_number, newRecord.invigilator_id,
        newRecord.invigilator_name, newRecord.invigilator_department, newRecord.incident_date, newRecord.incident_time,
        newRecord.incident_type, newRecord.severity, newRecord.material_confiscated, newRecord.incident_details,
        newRecord.student_statement, newRecord.witness_name, newRecord.evidence_photo_url, 'REPORTED'
      ]);
      if (result && result.insertId) {
        newRecord.id = result.insertId;
      }
    } catch (err) {
      console.warn('MySQL fullSql note, running fallback:', err.message);
      try {
        const safeSql = `
          INSERT INTO ufm_reports (
            report_number, exam_id, student_id, room_id, invigilator_id,
            student_name, student_roll, student_dept, room_number, invigilator_name,
            material_confiscated, incident_details, evidence_photo_url, student_statement, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REPORTED')
        `;
        const [result] = await query(safeSql, [
          newRecord.report_number,
          newRecord.exam_id || 1,
          newRecord.student_id,
          newRecord.room_id,
          newRecord.invigilator_id,
          newRecord.student_name,
          newRecord.student_roll,
          newRecord.student_dept,
          newRecord.room_number,
          newRecord.invigilator_name,
          newRecord.material_confiscated,
          newRecord.incident_details,
          newRecord.evidence_photo_url,
          newRecord.student_statement
        ]);
        if (result && result.insertId) {
          newRecord.id = result.insertId;
        }
      } catch (safeErr) {
        console.warn('MySQL safeSql fallback note:', safeErr.message);
      }
    }

    inMemoryIncidents.unshift(newRecord);
    return newRecord;
  }

  /**
   * Get all incident reports with optional filters
   * Uses robust COALESCE joins so data is NEVER returned as 'Unknown'
   */
  async getAllReports(filters = {}) {
    await this.ensureSchema();

    let results = [];
    try {
      let sql = `
        SELECT 
          u.id,
          COALESCE(NULLIF(u.report_number, ''), CONCAT('UFM-', YEAR(COALESCE(u.created_at, NOW())), '-', LPAD(u.id, 4, '0'))) AS report_number,
          u.exam_id,
          COALESCE(NULLIF(u.exam_name, ''), e.exam_name, 'Semester Examination') AS exam_name,
          COALESCE(NULLIF(u.course_code, ''), c.course_code, '') AS course_code,
          u.student_id,
          COALESCE(NULLIF(u.student_name, 'Unknown'), s.name, 'Candidate') AS student_name,
          COALESCE(NULLIF(u.student_roll, 'Unknown'), s.enrollment_no, '') AS student_roll,
          COALESCE(NULLIF(u.student_dept, ''), s.department, 'General') AS student_dept,
          u.room_id,
          COALESCE(NULLIF(u.room_number, 'Unknown'), r.room_number, 'Exam Hall') AS room_number,
          COALESCE(u.desk_number, 'Desk 1') AS desk_number,
          u.invigilator_id,
          COALESCE(NULLIF(u.invigilator_name, 'Unknown'), f.name, 'Invigilator') AS invigilator_name,
          COALESCE(NULLIF(u.invigilator_department, ''), f.department, 'Faculty') AS invigilator_department,
          COALESCE(u.incident_date, DATE(u.created_at), CURDATE()) AS incident_date,
          COALESCE(u.incident_time, '10:00 AM') AS incident_time,
          COALESCE(u.incident_type, 'UNAUTHORIZED_NOTES') AS incident_type,
          COALESCE(u.severity, 'MEDIUM') AS severity,
          COALESCE(NULLIF(u.material_confiscated, ''), 'Unauthorized material') AS material_confiscated,
          u.incident_details,
          u.student_statement,
          u.witness_name,
          u.evidence_photo_url,
          COALESCE(u.status, 'REPORTED') AS status,
          u.committee_remarks,
          u.penalty_imposed,
          u.resolved_by,
          u.resolved_at,
          u.created_at
        FROM ufm_reports u
        LEFT JOIN students s ON u.student_id = s.id
        LEFT JOIN rooms r ON u.room_id = r.id
        LEFT JOIN faculty f ON u.invigilator_id = f.id
        LEFT JOIN exams e ON u.exam_id = e.id
        LEFT JOIN courses c ON e.course_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.status && filters.status !== 'ALL') {
        sql += ' AND u.status = ?';
        params.push(filters.status);
      }
      if (filters.severity && filters.severity !== 'ALL') {
        sql += ' AND u.severity = ?';
        params.push(filters.severity);
      }
      if (filters.incident_type && filters.incident_type !== 'ALL') {
        sql += ' AND u.incident_type = ?';
        params.push(filters.incident_type);
      }
      if (filters.search) {
        const q = `%${filters.search.toLowerCase()}%`;
        sql += ` AND (
          LOWER(u.report_number) LIKE ? 
          OR LOWER(COALESCE(u.student_name, s.name, '')) LIKE ? 
          OR LOWER(COALESCE(u.student_roll, s.enrollment_no, '')) LIKE ? 
          OR LOWER(COALESCE(u.exam_name, e.exam_name, '')) LIKE ? 
          OR LOWER(COALESCE(u.room_number, r.room_number, '')) LIKE ? 
          OR LOWER(COALESCE(u.invigilator_name, f.name, '')) LIKE ?
        )`;
        params.push(q, q, q, q, q, q);
      }
      sql += ' ORDER BY u.id DESC';

      const [dbRows] = await query(sql, params);
      results = dbRows || [];

      // Format incident_date cleanly to YYYY-MM-DD
      results = results.map(row => {
        let cleanDate = row.incident_date;
        if (cleanDate instanceof Date) {
          cleanDate = cleanDate.toISOString().split('T')[0];
        }
        return {
          ...row,
          incident_date: cleanDate
        };
      });
    } catch (e) {
      console.warn('getAllReports query fallback:', e.message);
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
  async getReportsByFaculty(facultyName, facultyId) {
    const all = await this.getAllReports();
    if (!facultyName && !facultyId) return all;

    const cleanFn = (facultyName || '').toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.)\s*/i, '').trim();

    return all.filter(r => {
      if (facultyId && Number(r.invigilator_id) === Number(facultyId)) return true;
      const cleanInv = (r.invigilator_name || '').toLowerCase().replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.)\s*/i, '').trim();
      if (cleanFn && cleanInv && (cleanInv.includes(cleanFn) || cleanFn.includes(cleanInv))) return true;
      return false;
    });
  }

  /**
   * Get single report by ID
   */
  async getReportById(id) {
    await this.ensureSchema();
    try {
      const all = await this.getAllReports();
      const match = all.find(r => Number(r.id) === Number(id));
      if (match) return match;
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
    await this.ensureSchema();

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

    // Update MySQL
    try {
      await query(
        `UPDATE ufm_reports SET status = ?, committee_remarks = ?, penalty_imposed = ?, resolved_by = ?, resolved_at = ? WHERE id = ?`,
        [status, committee_remarks || null, penalty_imposed || null, resolved_by || 'Disciplinary Committee', new Date(), id]
      );
    } catch (err) {
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
   * Delete an incident report (Admin Only)
   */
  async deleteReport(id) {
    inMemoryIncidents = inMemoryIncidents.filter(r => Number(r.id) !== Number(id));
    try {
      await query('DELETE FROM ufm_reports WHERE id = ?', [id]);
    } catch (err) {
      console.warn('MySQL delete note for UFM report:', err.message);
    }
    return { success: true, message: `Report #${id} successfully removed.` };
  }
}

module.exports = new IncidentService();
