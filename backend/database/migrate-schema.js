const { query } = require('../config/db');

async function ensureColumn(table, column, definition) {
  const [rows] = await query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows.length === 0) {
    console.log(`Adding column ${table}.${column}...`);
    await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function runMigration() {
  console.log('🔄 Verifying and synchronizing database schema columns...');

  // 1. Courses
  await ensureColumn('courses', 'eligible_branches', "VARCHAR(255) DEFAULT 'CSE'");
  await ensureColumn('courses', 'credits', 'DECIMAL(3,1) DEFAULT 3.0');
  await ensureColumn('courses', 'semester', 'INT DEFAULT 1');
  await ensureColumn('courses', 'target_batch', 'VARCHAR(20) NULL');
  await ensureColumn('courses', 'difficulty_level', 'INT DEFAULT 3');
  await ensureColumn('courses', 'is_multidisciplinary', 'BOOLEAN DEFAULT FALSE');
  await ensureColumn('courses', 'is_lab_course', 'BOOLEAN DEFAULT FALSE');
  await ensureColumn('courses', 'course_coordinator_name', 'VARCHAR(100) NULL');
  await ensureColumn('courses', 'course_coordinator_id', 'INT NULL');
  await ensureColumn('courses', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  // 2. Rooms
  await ensureColumn('rooms', 'special_instructions', 'TEXT NULL');

  // 3. Faculty
  await ensureColumn('faculty', 'contact_number', 'VARCHAR(30) NULL');
  await ensureColumn('faculty', 'school', "VARCHAR(50) DEFAULT 'SOET'");
  await ensureColumn('faculty', 'staff_category', "ENUM('FACULTY', 'PHD_SCHOLAR', 'LAB_STAFF', 'EXTERNAL') NOT NULL DEFAULT 'FACULTY'");
  await ensureColumn('faculty', 'is_available', 'BOOLEAN DEFAULT TRUE');

  // 4. Students
  await ensureColumn('students', 'unique_id', 'VARCHAR(50) NULL');
  await ensureColumn('students', 'stream_section', 'VARCHAR(50) NULL');
  await ensureColumn('students', 'batch', 'VARCHAR(20) NULL');
  await ensureColumn('students', 'batch_year', "VARCHAR(20) DEFAULT '2025'");
  await ensureColumn('students', 'enrolled_courses', 'TEXT NULL');
  await ensureColumn('students', 'import_order', 'INT NULL DEFAULT 0');
  await ensureColumn('students', 'is_repeat_student', 'BOOLEAN DEFAULT FALSE');

  // 5. Exams
  await ensureColumn('exams', 'target_batch', 'VARCHAR(30) NULL');
  await ensureColumn('exams', 'academic_session', "VARCHAR(50) DEFAULT 'MID_TERM_MARCH_2026'");
  await ensureColumn('exams', 'shift', "ENUM('MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY') NOT NULL DEFAULT 'MORNING'");
  await ensureColumn('exams', 'reporting_time', "TIME DEFAULT '09:30:00'");
  await ensureColumn('exams', 'registered_students_count', 'INT DEFAULT 0');
  await ensureColumn('exams', 'required_rooms_count', 'INT DEFAULT 1');

  // Faculty reports may be submitted when no exam is currently scheduled.
  await ensureColumn('ufm_reports', 'submitted_by_email', 'VARCHAR(120) NULL');
  try {
    await query('ALTER TABLE ufm_reports MODIFY COLUMN exam_id INT NULL');
  } catch (err) {
    console.warn('UFM report schema note:', err.message);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS broadcast_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipient_email VARCHAR(120) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      provider VARCHAR(50) NULL,
      error_message TEXT NULL,
      sent_by_email VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL
    )
  `);

  // 6. Ensure course_section_instructors table exists
  await query(`
    CREATE TABLE IF NOT EXISTS course_section_instructors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      section_name VARCHAR(50) NOT NULL,
      instructor_name VARCHAR(100) NOT NULL,
      instructor_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  // 7. Demo Faculty accounts seeding removed

  // 8. Ensure all Courses are mapped to Department Faculty Instructors
  try {
    const [courses] = await query('SELECT id, course_code, department FROM courses WHERE course_coordinator_id IS NULL OR course_coordinator_name IS NULL');
    if (courses.length > 0) {
      const [cseFac] = await query('SELECT id, name, email FROM faculty WHERE department = "CSE" ORDER BY id ASC');
      const [eceFac] = await query('SELECT id, name, email FROM faculty WHERE department = "ECE" ORDER BY id ASC');
      const [meFac] = await query('SELECT id, name, email FROM faculty WHERE department = "ME" ORDER BY id ASC');
      const [allFac] = await query('SELECT id, name, email FROM faculty ORDER BY id ASC');

      const harshit = cseFac.find(f => f.name.includes('Harshit Malhotra')) || cseFac[0];

      for (let i = 0; i < courses.length; i++) {
        const c = courses[i];
        let assigned = null;
        if (['CSE2001', 'CSE3002', 'CSE3020'].includes(c.course_code)) {
          assigned = harshit;
        } else if (c.department === 'CSE' && cseFac.length > 0) {
          assigned = cseFac[i % cseFac.length];
        } else if (c.department === 'ECE' && eceFac.length > 0) {
          assigned = eceFac[i % eceFac.length];
        } else if (c.department === 'ME' && meFac.length > 0) {
          assigned = meFac[i % meFac.length];
        } else {
          assigned = allFac[i % allFac.length];
        }

        if (assigned) {
          await query('UPDATE courses SET course_coordinator_id = ?, course_coordinator_name = ? WHERE id = ?', [
            assigned.id,
            assigned.name,
            c.id
          ]);
          await query('INSERT INTO course_section_instructors (course_id, section_name, instructor_name, instructor_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE instructor_name = VALUES(instructor_name)', [
            c.id,
            'Section A',
            assigned.name,
            assigned.id
          ]);
        }
      }
      console.log(`✅ Associated ${courses.length} courses to departmental faculty instructors.`);
    }
  } catch (mapErr) {
    console.warn('Course instructor mapping note:', mapErr.message);
  }

  // 8. Ensure all students with enrolled_courses are mapped in student_courses table
  try {
    const [unlinkedStudents] = await query(`
      SELECT s.id, s.enrollment_no, s.enrolled_courses, s.department, s.semester
      FROM students s
      WHERE s.enrolled_courses IS NOT NULL AND s.enrolled_courses != ''
        AND NOT EXISTS (SELECT 1 FROM student_courses sc WHERE sc.student_id = s.id)
    `);
    if (unlinkedStudents.length > 0) {
      console.log(`🔄 Syncing course enrollments for ${unlinkedStudents.length} students...`);
      for (const s of unlinkedStudents) {
        const codes = (s.enrolled_courses || '').split(/[,;]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
        for (const code of codes) {
          let [cRows] = await query('SELECT id FROM courses WHERE UPPER(course_code) = ?', [code]);
          let courseId = cRows[0]?.id;
          if (!courseId) {
            const [cRes] = await query(
              'INSERT INTO courses (course_code, course_name, department, semester, difficulty_level) VALUES (?, ?, ?, ?, 3) ON DUPLICATE KEY UPDATE course_code = course_code',
              [code, code + ' Course', s.department || 'CSE', s.semester || 1]
            );
            courseId = cRes?.insertId;
            if (!courseId) {
              const [cFound] = await query('SELECT id FROM courses WHERE UPPER(course_code) = ?', [code]);
              courseId = cFound[0]?.id;
            }
          }
          if (courseId) {
            await query(
              'INSERT IGNORE INTO student_courses (student_id, course_id) VALUES (?, ?)',
              [s.id, courseId]
            );
          }
        }
      }
      console.log(`✅ Synchronized course enrollments into student_courses.`);
    }
  } catch (syncErr) {
    console.warn('Student course sync note:', syncErr.message);
  }

  console.log('✅ Database schema verified and synchronized successfully!');
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigration };

