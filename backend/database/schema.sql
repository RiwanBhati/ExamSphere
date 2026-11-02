-- ====================================================================
-- ExamSphere: Automated Exam Management System
-- Master Relational Database Schema (MySQL 8.0+)
-- Enhanced & Extended as per BMU SOET Mid-Term Examination Blueprint
-- Supports Multi-Shift Exams, Multi-Invigilator Halls, Booklet Inventory,
-- Course Sections, Question Paper Logistics & Shift Discussion Logs
-- ====================================================================

CREATE DATABASE IF NOT EXISTS examsphere_db;
USE examsphere_db;

-- --------------------------------------------------------------------
-- 1. USERS & AUTHENTICATION TABLE (Module 1)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'FACULTY', 'STUDENT', 'EXAM_CELL', 'STAFF') NOT NULL DEFAULT 'FACULTY',
    phone_number VARCHAR(20) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 2. COURSES MASTER TABLE (Module 2)
-- Enhanced with Credits, Target Batches, Eligible Branches & Coordinator
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(150) NOT NULL,
    department VARCHAR(50) NOT NULL,
    eligible_branches VARCHAR(255) DEFAULT 'CSE', -- e.g., 'CSE, Mech', 'CSE, ECOM, Mech'
    credits DECIMAL(3,1) DEFAULT 3.0,            -- e.g., 1.0, 2.0, 3.0, 4.0
    semester INT DEFAULT 1,
    target_batch VARCHAR(20) NULL,               -- e.g., '2023', '2024', '2025', 'MDC'
    difficulty_level INT DEFAULT 3,              -- 1 (Easy) to 5 (Hard) for Hardness-Optimized Scheduling
    is_multidisciplinary BOOLEAN DEFAULT FALSE,  -- True for courses like FIN1001
    is_lab_course BOOLEAN DEFAULT FALSE,         -- True for lab exams like DBMS
    course_coordinator_name VARCHAR(120) NULL,   -- e.g., 'Dr. Palak Goel', 'Dr. Luckshay Batra'
    course_coordinator_id INT NULL,              -- References faculty(id) if registered
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 2b. COURSE SECTION INSTRUCTORS TABLE
-- Captures section-wise instructor mapping (CSE1..CSE8, ME, ECOMP)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_section_instructors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    section_name VARCHAR(50) NOT NULL,           -- e.g., 'CSE1', 'CSE2', 'ME', 'ECOMP'
    instructor_name VARCHAR(120) NOT NULL,       -- e.g., 'Dr. Palak Goel', 'Dr. Satpal Singh'
    instructor_id INT NULL,                      -- References faculty(id) if matched
    lecture_or_lab ENUM('LECTURE', 'LAB', 'BOTH') DEFAULT 'LECTURE',
    academic_year VARCHAR(20) DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_course_section (course_id, section_name, academic_year),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 3. STUDENTS MASTER TABLE (Module 2)
-- Enhanced with Unique ID, Stream/Section (CSE V, CSE VI)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    enrollment_no VARCHAR(50) NOT NULL UNIQUE,   -- e.g., '250C2030116'
    unique_id VARCHAR(50) NULL,                  -- e.g., '250378'
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,             -- e.g., 'CSE', 'ME', 'ECOM'
    stream_section VARCHAR(50) NULL,             -- e.g., 'CSE V', 'CSE VI', 'CSE-1'
    batch_year VARCHAR(20) DEFAULT '2025',       -- e.g., '2023', '2024', '2025'
    semester INT DEFAULT 1,
    program VARCHAR(50) DEFAULT 'B.Tech',
    enrolled_courses TEXT NULL,
    is_repeat_student BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 3b. STUDENT COURSE ENROLLMENTS TABLE (Module 2)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    academic_year VARCHAR(20) DEFAULT '2025-2026',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_student_course (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 4. FACULTY & STAFF MASTER TABLE (Module 2)
-- Enhanced with Staff Category (FACULTY, PHD_SCHOLAR / RS, LAB_STAFF, EXTERNAL),
-- Contact Phone, School (SOET, I2E, IQAC), & Duty Preferences
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculty (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    faculty_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    contact_number VARCHAR(30) NULL,             -- e.g., '9837752718'
    department VARCHAR(50) NOT NULL DEFAULT 'SOET',
    school VARCHAR(50) DEFAULT 'SOET',           -- e.g., 'SOET', 'I2E', 'IQAC'
    designation VARCHAR(50) DEFAULT 'Assistant Professor',
    staff_category ENUM('FACULTY', 'PHD_SCHOLAR', 'LAB_STAFF', 'EXTERNAL') NOT NULL DEFAULT 'FACULTY',
    seniority_level INT DEFAULT 1,               -- 1: Junior/Scholar, 2: Associate, 3: Professor/Dean
    max_duties INT DEFAULT 5,
    assigned_duties_count INT DEFAULT 0,
    availability_notes TEXT NULL,                -- e.g., 'After 23rd', 'dont use on friday Ist half'
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_faculty_name (name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 5. ROOMS MASTER TABLE (Module 2)
-- Enhanced with Building Block (NB, GA, GBL), Room Type & Capacity
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(50) NOT NULL UNIQUE,
    building VARCHAR(50) NOT NULL,
    capacity INT NOT NULL,
    rows_count INT NOT NULL DEFAULT 5,
    cols_count INT NOT NULL DEFAULT 6,
    is_available BOOLEAN DEFAULT TRUE,
    special_instructions TEXT NULL,              -- e.g., 'dont use on entire day on thursday'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 5b. ROOM USAGE CONSTRAINTS / BLACKOUT DATES TABLE
-- Captures conditional room blocks (e.g., NB213 Thursday blocked, NB215 Friday blocked)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_constraints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    blackout_date DATE NOT NULL,
    shift ENUM('ALL', 'MORNING', 'AFTERNOON', 'EVENING') DEFAULT 'ALL',
    reason VARCHAR(255) NOT NULL,                -- e.g., 'Lab setup / Reserved for EME in GA102'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 6. EXAMS TABLE (Module 3 - Member 2)
-- Enhanced with Shifts (MORNING, AFTERNOON, EVENING, FULL_DAY),
-- Reporting Times, Batch Targets, Student Counts & Room Requirements
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    exam_name VARCHAR(150) NOT NULL,
    exam_type ENUM('QUIZ', 'MID_TERM', 'END_TERM') DEFAULT 'MID_TERM',
    target_batch VARCHAR(30) NULL,               -- e.g., '2023', '2024', '2025', 'ALL'
    academic_session VARCHAR(50) DEFAULT 'MID_TERM_MARCH_2026',
    exam_date DATE NOT NULL,
    shift ENUM('MORNING', 'AFTERNOON', 'EVENING', 'FULL_DAY') NOT NULL DEFAULT 'MORNING',
    reporting_time TIME DEFAULT '09:30:00',      -- e.g., 09:30 AM, 01:30 PM, 03:30 PM
    start_time TIME NOT NULL DEFAULT '10:00:00',
    end_time TIME NOT NULL DEFAULT '12:00:00',
    duration_minutes INT NOT NULL DEFAULT 120,
    registered_students_count INT DEFAULT 0,
    required_rooms_count INT DEFAULT 1,
    seating_plan_status ENUM('PENDING', 'GENERATED', 'VERIFIED', 'PUBLISHED') DEFAULT 'PENDING',
    status ENUM('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'SCHEDULED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_course_date_shift (course_id, exam_date, shift),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 7. SEAT ALLOCATIONS TABLE (Module 4 - Member 2)
-- Enhanced with Desk Number and Student Roll / Unique ID
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    room_id INT NOT NULL,
    student_id INT NOT NULL,
    row_num INT NOT NULL,
    col_num INT NOT NULL,
    seat_number VARCHAR(20) NOT NULL,            -- e.g., 'NB203-R1-C1'
    desk_label VARCHAR(30) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exam_seat (exam_id, room_id, row_num, col_num),
    UNIQUE KEY uq_exam_student (exam_id, student_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- 8. INVIGILATION DUTIES TABLE (Module 5 - Member 2)
-- Supports Multi-Invigilator Halls (GBL01 has 12, GA102 has 5),
-- Invigilator Roles (CHIEF, ASSISTANT, LAB_SUPPORT, RELIEVER),
-- and Substitute Faculty
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invigilation_duties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    room_id INT NOT NULL,
    faculty_id INT NOT NULL,
    duty_role ENUM('CHIEF_INVIGILATOR', 'ASSISTANT_INVIGILATOR', 'LAB_SUPPORT', 'RELIEVER', 'OBSERVER') DEFAULT 'ASSISTANT_INVIGILATOR',
    status ENUM('ASSIGNED', 'REPORTED', 'CONFIRMED', 'ABSENT', 'SUBSTITUTED') DEFAULT 'ASSIGNED',
    substitute_faculty_id INT NULL,
    is_own_exam BOOLEAN DEFAULT FALSE,           -- True if faculty teaches the course being examined
    reporting_confirmed_at TIMESTAMP NULL,
    signature_confirmed BOOLEAN DEFAULT FALSE,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Allows multiple invigilators per room/exam, but prevents duplicate assignment of the same faculty to the same room/exam
    UNIQUE KEY uq_exam_room_faculty (exam_id, room_id, faculty_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (substitute_faculty_id) REFERENCES faculty(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 9. ATTENDANCE RECORDS TABLE (Module 7 - Member 3)
-- Enhanced with Answer Booklet Number & Supplementary Sheet Tracking
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    student_id INT NOT NULL,
    room_id INT NOT NULL,
    status ENUM('PRESENT', 'ABSENT', 'FLAGGED', 'UFM') DEFAULT 'PRESENT',
    answer_booklet_no VARCHAR(50) NULL,          -- Serial number of candidate answer booklet
    supp_sheets_issued INT DEFAULT 0,            -- Number of supplementary sheets taken
    supp_sheet_numbers VARCHAR(255) NULL,        -- Comma-separated serial numbers of supp sheets
    verification_method ENUM('MANUAL', 'FACE_MATCH', 'BARCODE') DEFAULT 'MANUAL',
    face_confidence DECIMAL(5,2) NULL,
    photo_path VARCHAR(255) NULL,
    student_signature_verified BOOLEAN DEFAULT FALSE,
    marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    marked_by_invigilator_id INT NULL,
    UNIQUE KEY uq_attendance (exam_id, student_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (marked_by_invigilator_id) REFERENCES faculty(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 10. ANSWER BOOKLET & STATIONERY INVENTORY LOGISTICS TABLE
-- Tracks main answer booklets and supplementary sheets issued, used & returned
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stationery_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    room_id INT NOT NULL,
    shift ENUM('MORNING', 'AFTERNOON', 'EVENING') NOT NULL DEFAULT 'MORNING',
    main_booklets_issued INT NOT NULL DEFAULT 32,
    supp_sheets_issued INT NOT NULL DEFAULT 50,
    main_booklets_used INT NOT NULL DEFAULT 0,
    supp_sheets_used INT NOT NULL DEFAULT 0,
    main_booklets_unused INT NOT NULL DEFAULT 0,
    supp_sheets_unused INT NOT NULL DEFAULT 0,
    issuing_officer_name VARCHAR(100) DEFAULT 'Exam Control Room',
    receiving_invigilator_id INT NULL,
    returned_at TIMESTAMP NULL,
    status ENUM('ISSUED', 'RETURNED', 'VERIFIED', 'DISCREPANCY') DEFAULT 'ISSUED',
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_exam_room_stationery (exam_id, room_id),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (receiving_invigilator_id) REFERENCES faculty(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 11. QUESTION PAPER (QP) LOGISTICS TABLE
-- Tracks question paper requirements, coordinator submissions & printing
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_paper_logistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    exam_id INT NULL,
    coordinator_name VARCHAR(120) NOT NULL,
    coordinator_id INT NULL,
    required_qp_count INT NOT NULL DEFAULT 0,     -- e.g., 502, 445, 190
    receiving_status ENUM('PENDING', 'RECEIVED', 'PRINTED', 'PACKED', 'DISPATCHED') DEFAULT 'PENDING',
    is_received BOOLEAN DEFAULT FALSE,
    submission_date DATE NULL,
    answer_sheets_received BOOLEAN DEFAULT FALSE,
    remarks VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
    FOREIGN KEY (coordinator_id) REFERENCES faculty(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 12. EXAM SCHEDULING DISCUSSIONS & SHIFT RESOLUTION LOG
-- Captures planning discussions (e.g. room shortage, batch shifts, lab notes)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_scheduling_discussions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    discussion_topic VARCHAR(255) NOT NULL,      -- e.g., 'IoT Networks afternoon schedule', 'Theory of Computation room shortage'
    query_text TEXT NOT NULL,
    resolution_text TEXT NOT NULL,
    status ENUM('OPEN', 'RESOLVED', 'IMPLEMENTED') DEFAULT 'IMPLEMENTED',
    affected_batch VARCHAR(50) NULL,             -- e.g., '2023', '2025'
    action_taken TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 13. UNFAIR MEANS (UFM) INCIDENTS TABLE (Module 8)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ufm_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_number VARCHAR(50) NOT NULL UNIQUE,
    exam_id INT NULL,
    exam_name VARCHAR(150) NULL,
    course_code VARCHAR(50) NULL,
    student_id INT NULL,
    student_name VARCHAR(120) NOT NULL,
    student_roll VARCHAR(50) NOT NULL,
    student_dept VARCHAR(100) NULL,
    room_id INT NULL,
    room_number VARCHAR(50) NOT NULL,
    desk_number VARCHAR(50) NULL,
    invigilator_id INT NULL,
    invigilator_name VARCHAR(120) NOT NULL,
    invigilator_department VARCHAR(100) NULL,
    submitted_by_email VARCHAR(120) NULL,
    incident_date DATE NOT NULL,
    incident_time VARCHAR(20) NULL,
    incident_type ENUM('UNAUTHORIZED_NOTES', 'MOBILE_DEVICE', 'SMARTWATCH_DEVICE', 'COPYING_NEIGHBOR', 'IMPERSONATION', 'COMMUNICATION', 'OTHER') NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    material_confiscated TEXT NOT NULL,
    incident_details TEXT NOT NULL,
    student_statement TEXT NULL,
    witness_name VARCHAR(120) NULL,
    evidence_photo_url LONGTEXT NULL,
    status ENUM('REPORTED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'DISMISSED') DEFAULT 'REPORTED',
    committee_remarks TEXT NULL,
    penalty_imposed VARCHAR(255) NULL,
    resolved_by VARCHAR(120) NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    FOREIGN KEY (invigilator_id) REFERENCES faculty(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 14. LIVE DOUBT REQUESTS TABLE (Module 8 - Member 3)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doubt_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    room_id INT NOT NULL,
    student_id INT NOT NULL,
    faculty_id INT NOT NULL, -- Subject faculty pinged
    invigilator_id INT NULL, -- Invigilator who forwarded the doubt from exam hall
    invigilator_name VARCHAR(120) NULL,
    question_text TEXT NOT NULL,
    response_text TEXT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'VISITED', 'RESOLVED') DEFAULT 'PENDING',
    urgency ENUM('NORMAL', 'HIGH', 'CRITICAL') DEFAULT 'HIGH',
    email_sent BOOLEAN DEFAULT TRUE,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (invigilator_id) REFERENCES faculty(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 15. NOTIFICATIONS & ALERTS TABLE (Module 9 - Member 4)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    recipient_email VARCHAR(120) NOT NULL,
    type ENUM('STUDENT_SEAT', 'FACULTY_DUTY', 'EMERGENCY_ALERT') NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    delivery_status ENUM('PENDING', 'SENT', 'FAILED') DEFAULT 'PENDING',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

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
);

-- --------------------------------------------------------------------
-- 16. AUDIT LOGS TABLE (Module 11 - Member 1)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------------
-- 17. SYSTEM SETTINGS TABLE (Global Configuration & Timetable Span)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ====================================================================
-- SEED INITIAL DEFAULT ADMIN USER (Password: admin123)
-- ====================================================================
INSERT IGNORE INTO users (id, name, email, password_hash, role)
VALUES (1, 'Exam Controller Admin', 'admin@examsphere.edu', '$2a$10$ZFq8iPrP2/7Uv0aTMgzNcur5xvjI5N7e5zKF6HLZG4Wi4MeMySlQm', 'ADMIN');
