const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Canonical field name synonyms for smart column normalization
const COLUMN_SYNONYMS = {
  // Courses
  course_code: ['course_code', 'course code', 'code', 'sub_code', 'subject_code', 'course_no', 'coursecode'],
  course_name: ['course_name', 'course', 'course title', 'subject', 'subject_name', 'subject title', 'title', 'coursename'],
  department: ['department', 'dept', 'branch', 'stream', 'school', 'discipline'],
  semester: ['semester', 'sem', 'term'],
  difficulty_level: ['difficulty_level', 'difficulty', 'diff', 'hardness'],
  credits: ['credits', 'credit', 'cr'],
  course_coordinator_name: ['course_coordinator', 'course coordinator', 'coordinator', 'coordinator_name', 'faculty coordinator'],
  target_batch: ['target_batch', 'batch', 'year', 'batch_year', 'academic_year'],

  // Rooms
  room_number: ['room_number', 'room no', 'room no.', 'room', 'room_no', 'hall', 'room number', 'venue'],
  building: ['building', 'block', 'bldg', 'wing'],
  capacity: ['capacity', 'seating capacity', 'seating_capacity', 'seats', 'strength', 'no. of students', 'no. of rooms required'],
  rows_count: ['rows_count', 'rows', 'row_count', 'row'],
  cols_count: ['cols_count', 'cols', 'col_count', 'col', 'columns'],
  special_instructions: ['special_instructions', 'instructions', 'notes', 'remarks', 'comments'],

  // Faculty
  faculty_code: ['faculty_code', 'faculty code', 'code', 'emp_id', 'employee_id', 'id'],
  name: ['name', 'faculty_name', 'faculty name', 'student_name', 'student name', 'full_name', 'full name', 'invigilator', 'invigilators'],
  email: ['email', 'email_id', 'mail', 'email address'],
  designation: ['designation', 'post', 'role', 'title'],
  max_duties: ['max_duties', 'max duties', 'duties_limit', 'duties'],
  contact_number: ['contact', 'contact_number', 'phone', 'mobile', 'contact no', 'mobile no'],
  staff_category: ['staff_category', 'category', 'type', 'staff type'],

  // Students
  enrollment_no: ['enrollment_no', 'enrollment no', 'enrollment', 'roll_no', 'roll no', 'roll_number', 'roll number'],
  program: ['program', 'degree', 'course_program'],
  enrolled_courses: ['enrolled_courses', 'enrolled courses', 'enrolled_subjects', 'enrolled subjects', 'courses', 'subjects'],
  unique_id: ['unique_id', 'unique id', 'uid', 'student_id'],
  stream_section: ['stream_section', 'section', 'stream / section', 'stream']
};

// Expected columns for each entity matching Resource & Data Management schemas
const REQUIRED_SCHEMAS = {
  students: ['enrollment_no', 'name', 'email', 'department', 'semester', 'program', 'enrolled_courses'],
  faculty: ['faculty_code', 'name', 'email', 'department', 'designation', 'max_duties'],
  courses: ['course_code', 'course_name', 'department', 'semester', 'difficulty_level'],
  rooms: ['room_number', 'building', 'capacity', 'rows_count', 'cols_count'],
  'master-sheet': []
};

/**
 * Normalizes raw row object using synonym dictionary
 */
function normalizeRow(rawRow) {
  const normalized = {};
  const lowerKeyMap = {};

  for (const [key, val] of Object.entries(rawRow)) {
    const cleanKey = String(key).trim().toLowerCase();
    const cleanVal = typeof val === 'string' ? val.trim() : val;
    lowerKeyMap[cleanKey] = cleanVal;
  }

  // Map known canonical fields
  for (const [canonicalField, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const syn of synonyms) {
      if (lowerKeyMap[syn] !== undefined && lowerKeyMap[syn] !== '') {
        normalized[canonicalField] = lowerKeyMap[syn];
        break;
      }
    }
  }

  // Preserve any unmapped properties with sanitized keys
  for (const [cleanKey, val] of Object.entries(lowerKeyMap)) {
    const slug = cleanKey.replace(/[^a-z0-9_]/g, '_');
    if (normalized[slug] === undefined) {
      normalized[slug] = val;
    }
  }

  // Support alias for enrolled_subjects <-> enrolled_courses
  if (normalized.enrolled_subjects && !normalized.enrolled_courses) {
    normalized.enrolled_courses = normalized.enrolled_subjects;
  }

  return normalized;
}

/**
 * Robust extraction of data rows from a sheet with intelligent header row detection.
 * Handles Excel files with title banners, merged headers, or metadata in the top rows.
 */
function extractRowsFromWorksheet(worksheet, entityType) {
  if (!worksheet) return [];

  // Read as 2D array of rows
  const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!grid || grid.length === 0) return [];

  const KEYWORDS_BY_TYPE = {
    courses: ['course code', 'course_code', 'course', 'subject', 'sub_code', 'sub code'],
    rooms: ['room no', 'room_no', 'room', 'room_number', 'capacity', 'seating capacity'],
    faculty: ['faculty name', 'faculty_name', 'name', 'invigilator', 'teacher', 'email'],
    students: ['enrollment', 'enrollment no', 'roll no', 'roll_no', 'unique id', 'student name']
  };

  const targetKeywords = KEYWORDS_BY_TYPE[entityType] || ['name', 'code', 'room', 'id'];

  let headerRowIndex = 0;
  let maxMatchCount = 0;

  // Scan top 25 rows to identify the actual column header row
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const rowCells = grid[r].map(c => String(c).trim().toLowerCase());
    const matchCount = targetKeywords.filter(kw => rowCells.some(cell => cell.includes(kw))).length;
    if (matchCount > maxMatchCount) {
      maxMatchCount = matchCount;
      headerRowIndex = r;
    }
  }

  const rawHeaders = (grid[headerRowIndex] || []).map(h => String(h).trim());
  const rows = [];

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const rowArr = grid[r];
    if (!rowArr || rowArr.every(c => String(c).trim() === '')) continue; // Skip blank rows

    const rowObj = {};
    rawHeaders.forEach((header, colIdx) => {
      if (header) {
        rowObj[header] = rowArr[colIdx] !== undefined ? rowArr[colIdx] : '';
      }
    });

    rows.push(rowObj);
  }

  return rows;
}

/**
 * Reads any spreadsheet file (.xlsx, .xls, .csv) and returns normalized row objects.
 * Scans all sheets if targetSheetName is not found.
 */
function readSpreadsheetRows(filePath, targetEntityType = null) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  let candidateRows = [];

  // First try direct sheet name match
  if (targetEntityType) {
    const directMatch = workbook.SheetNames.find(
      s => s.toLowerCase().trim().includes(targetEntityType.toLowerCase().trim())
    );
    if (directMatch) {
      candidateRows = extractRowsFromWorksheet(workbook.Sheets[directMatch], targetEntityType);
      if (candidateRows.length > 0) return candidateRows;
    }
  }

  // Otherwise, scan all sheets in the workbook and return the sheet with the most valid matches
  for (const sheetName of workbook.SheetNames) {
    const sheetRows = extractRowsFromWorksheet(workbook.Sheets[sheetName], targetEntityType);
    if (sheetRows.length > candidateRows.length) {
      candidateRows = sheetRows;
    }
  }

  return candidateRows;
}

/**
 * Parse and validate a spreadsheet (.xlsx, .xls, or .csv)
 */
async function parseAndValidateSpreadsheet(filePath, entityType) {
  if (entityType === 'master-sheet') {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    return { validRows: [], errorRows: [], workbook };
  }

  const requiredFields = REQUIRED_SCHEMAS[entityType] || [];
  const rawRows = readSpreadsheetRows(filePath, entityType);

  const validRows = [];
  const errorRows = [];

  rawRows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2;
    const row = normalizeRow(rawRow);

    // Apply smart field inference if optional fields are missing
    if (entityType === 'courses') {
      if (!row.course_code && row.code) row.course_code = row.code;
      if (!row.course_name && row.course) row.course_name = row.course;
      if (!row.department && row.eligible_branches) row.department = row.eligible_branches.split(',')[0].trim();
      if (!row.department && row.branch) row.department = row.branch.split(',')[0].trim();
      if (!row.department) row.department = 'CSE';
      if (!row.credits && row.credit) row.credits = row.credit;
    }

    if (entityType === 'rooms') {
      if (!row.building) {
        const match = String(row.room_number || '').match(/^([A-Za-z]+)/);
        row.building = match ? match[1].toUpperCase() : 'Main Block';
      }
      if (!row.capacity) {
        row.capacity = 30; // standard default
      }
    }

    if (entityType === 'faculty') {
      if (!row.faculty_code) {
        const cleanName = (row.name || 'FAC').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        row.faculty_code = `FAC_${cleanName}_${rowNumber}`;
      }
      if (!row.email && row.name) {
        row.email = `${row.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${rowNumber}@bmu.edu.in`;
      }
      if (!row.department) row.department = 'SOET';
      if (String(row.name || '').includes('(RS)') || String(row.designation || '').toLowerCase().includes('scholar')) {
        row.staff_category = 'PHD_SCHOLAR';
      } else if (String(row.designation || '').toLowerCase().includes('technician') || String(row.designation || '').toLowerCase().includes('assistant')) {
        row.staff_category = 'LAB_STAFF';
      } else {
        row.staff_category = 'FACULTY';
      }
    }

    if (entityType === 'students') {
      if (!row.department) row.department = 'CSE';
      if (!row.email && row.name) {
        const uid = row.unique_id || row.enrollment_no || rowNumber;
        row.email = `${row.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}.${uid}@bmu.edu.in`;
      }
    }

    // Validate required fields
    const missing = requiredFields.filter(f => !row[f] || String(row[f]).trim() === '');
    if (missing.length > 0) {
      errorRows.push({
        rowNumber,
        data: row,
        error: `Missing required field(s): ${missing.join(', ')}`
      });
    } else {
      validRows.push(row);
    }
  });

  return { validRows, errorRows };
}

// Backwards-compatible alias
const parseAndValidateCSV = parseAndValidateSpreadsheet;

module.exports = {
  parseAndValidateSpreadsheet,
  parseAndValidateCSV,
  readSpreadsheetRows,
  extractRowsFromWorksheet,
  normalizeRow,
  REQUIRED_SCHEMAS,
  COLUMN_SYNONYMS
};
