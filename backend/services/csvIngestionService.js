const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query } = require('../config/db');
const { parseAndValidateSpreadsheet, normalizeRow } = require('../utils/csvParser');

const { mapDesignationToSeniority } = require('../utils/designationHelper');

/**
 * Safely extract numeric digits from strings like "Sem 3", "Semester 4", "Sem-5", "4th", or 3
 */
function extractNumber(val, defaultVal = 1) {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (!val) return defaultVal;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : defaultVal;
}

/**
 * Strategy Pattern: Entity Ingestion Strategies
 * Supports both Excel (.xlsx, .xls) and CSV (.csv) formats with extended attributes.
 */
const INGESTION_STRATEGIES = {
  students: async (rows) => {
    let count = 0;
    for (const row of rows) {
      const semester = extractNumber(row.semester, 1);
      const [result] = await query(
        `INSERT INTO students (enrollment_no, name, email, department, semester, program)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), department = VALUES(department), semester = VALUES(semester), program = VALUES(program)`,
        [row.enrollment_no, row.name, row.email, row.department, semester, row.program || 'B.Tech']
      );

      // Resolve student id
      let studentId = result.insertId;
      if (!studentId) {
        const [[existing]] = await query('SELECT id FROM students WHERE enrollment_no = ?', [row.enrollment_no]);
        if (existing) studentId = existing.id;
      }

      // Link enrolled subjects into student_courses junction table
      const enrolledStr = row.enrolled_courses || row.enrolled_subjects || '';
      if (enrolledStr && studentId) {
        const courseCodes = enrolledStr.split(/[,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
        for (const code of courseCodes) {
          const [[course]] = await query('SELECT id FROM courses WHERE UPPER(course_code) = ?', [code]);
          if (course) {
            await query(
              'INSERT IGNORE INTO student_courses (student_id, course_id) VALUES (?, ?)',
              [studentId, course.id]
            );
          }
        }
      }

      count++;
    }
    return count;
  },

  faculty: async (rows) => {
    let count = 0;
    for (const row of rows) {
      const designation = row.designation || 'Assistant Professor';
      // Automatically derive seniority level from designation if not explicitly provided
      const seniorityLevel = (row.seniority_level !== undefined && row.seniority_level !== null && row.seniority_level !== '' && !isNaN(parseInt(row.seniority_level, 10)))
        ? parseInt(row.seniority_level, 10)
        : mapDesignationToSeniority(designation);

      await query(
        `INSERT INTO faculty (faculty_code, name, email, department, designation, seniority_level, max_duties)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), department = VALUES(department), designation = VALUES(designation), seniority_level = VALUES(seniority_level), max_duties = VALUES(max_duties)`,
        [row.faculty_code, row.name, row.email, row.department, designation, seniorityLevel, extractNumber(row.max_duties, 5)]
      );
      count++;
    }
    return count;
  },

  courses: async (rows) => {
    let count = 0;
    for (const row of rows) {
      const semester = extractNumber(row.semester, 1);
      const difficulty = extractNumber(row.difficulty_level, 3);
      await query(
        `INSERT INTO courses (course_code, course_name, department, semester, eligible_branches, credits, target_batch, course_coordinator_name, difficulty_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            course_name = VALUES(course_name), 
            department = VALUES(department), 
            semester = VALUES(semester),
            eligible_branches = COALESCE(VALUES(eligible_branches), eligible_branches),
            credits = COALESCE(VALUES(credits), credits),
            target_batch = COALESCE(VALUES(target_batch), target_batch),
            course_coordinator_name = COALESCE(VALUES(course_coordinator_name), course_coordinator_name),
            difficulty_level = VALUES(difficulty_level)`,
        [
          row.course_code,
          row.course_name,
          row.department || 'CSE',
          semester,
          row.eligible_branches || row.department || 'CSE',
          parseFloat(row.credits) || 3.0,
          row.target_batch || null,
          row.course_coordinator_name || null,
          difficulty
        ]
      );
      count++;
    }
    return count;
  },

  rooms: async (rows) => {
    let count = 0;
    for (const row of rows) {
      const capacity = extractNumber(row.capacity, 30);
      const rowsCount = extractNumber(row.rows_count, 5);
      const colsCount = extractNumber(row.cols_count, Math.ceil(capacity / rowsCount));
      await query(
        `INSERT INTO rooms (room_number, building, capacity, rows_count, cols_count)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE building = VALUES(building), capacity = VALUES(capacity), rows_count = VALUES(rows_count), cols_count = VALUES(cols_count)`,
        [row.room_number, row.building, capacity, rowsCount, colsCount]
      );
      count++;
    }
    return count;
  },

  'master-sheet': async (workbook) => {
    let totalIngested = 0;
    const summary = { courses: 0, rooms: 0, faculty: 0, students: 0 };

    for (const sheetName of workbook.SheetNames) {
      const sLower = sheetName.toLowerCase().trim();
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      if (rawRows.length === 0) continue;

      const normalizedRows = rawRows.map(normalizeRow);

      if (sLower.includes('course') || sLower.includes('subject') || sLower.includes('timetable') || normalizedRows[0]?.course_code) {
        const valid = normalizedRows.filter(r => r.course_code && r.course_name);
        if (valid.length > 0) {
          const count = await INGESTION_STRATEGIES.courses(valid);
          summary.courses += count;
          totalIngested += count;
        }
      }

      if (sLower.includes('room') || sLower.includes('venue') || sLower.includes('seating') || normalizedRows[0]?.room_number) {
        const valid = normalizedRows.filter(r => r.room_number);
        if (valid.length > 0) {
          const count = await INGESTION_STRATEGIES.rooms(valid);
          summary.rooms += count;
          totalIngested += count;
        }
      }

      if (sLower.includes('faculty') || sLower.includes('teacher') || sLower.includes('invigilator') || sLower.includes('scholar') || normalizedRows[0]?.faculty_code) {
        const valid = normalizedRows.filter(r => r.name);
        if (valid.length > 0) {
          const count = await INGESTION_STRATEGIES.faculty(valid);
          summary.faculty += count;
          totalIngested += count;
        }
      }

      if (sLower.includes('student') || sLower.includes('attendance') || sLower.includes('candidate') || normalizedRows[0]?.enrollment_no) {
        const valid = normalizedRows.filter(r => r.enrollment_no && r.name);
        if (valid.length > 0) {
          const count = await INGESTION_STRATEGIES.students(valid);
          summary.students += count;
          totalIngested += count;
        }
      }
    }

    return { totalIngested, summary };
  }
};

class SpreadsheetIngestionService {
  /**
   * Ingest any supported spreadsheet file (.xlsx, .xls, .csv)
   */
  async ingestSpreadsheet(filePath, entityType) {
    const strategy = INGESTION_STRATEGIES[entityType];
    if (!strategy) {
      throw new Error(`Unsupported entity type: ${entityType}. Supported: students, faculty, courses, rooms, master-sheet.`);
    }

    try {
      if (entityType === 'master-sheet') {
        const workbook = XLSX.readFile(filePath, { cellDates: true });
        const { totalIngested, summary } = await strategy(workbook);

        return {
          totalRowsProcessed: totalIngested,
          insertedOrUpdated: totalIngested,
          failedRowsCount: 0,
          errors: [],
          sheetSummary: summary
        };
      }

      const { validRows, errorRows } = await parseAndValidateSpreadsheet(filePath, entityType);
      const insertedCount = await strategy(validRows);

      return {
        totalRowsProcessed: validRows.length + errorRows.length,
        insertedOrUpdated: insertedCount,
        failedRowsCount: errorRows.length,
        errors: errorRows
      };
    } finally {
      // Defensive file cleanup
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    }
  }

  // Backwards-compatible alias
  async ingestCSV(filePath, entityType) {
    return this.ingestSpreadsheet(filePath, entityType);
  }
}

module.exports = new SpreadsheetIngestionService();
