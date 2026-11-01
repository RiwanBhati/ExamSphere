const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const authService = require('../services/authService');
const { parseAndValidateCSV } = require('../utils/csvParser');
const { query } = require('../config/db');

async function testRequirements() {
  console.log('======================================================');
  console.log('🧪 TESTING USER REQUIREMENTS (ADMIN & FACULTY CONSTRAINTS)');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  // ---------------- REQUIREMENT 1 (BLANK FIELD CHECK) ----------------
  // During login, when both fields are empty, display "Email and password are required".
  total++;
  try {
    await authService.loginUser({ email: '', password: '' });
    assert.fail('Should have failed on empty credentials');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'Email and password are required');
    console.log('✅ [PASSED] Empty email & password throws "Email and password are required"');
    passed++;
  }

  total++;
  try {
    await authService.loginUser({ email: '   ', password: '   ' });
    assert.fail('Should have failed on whitespace-only credentials');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'Email and password are required');
    console.log('✅ [PASSED] Whitespace email & password throws "Email and password are required"');
    passed++;
  }

  // ---------------- REQUIREMENT 2 (CSV UPLOAD CHECKS) ----------------
  // Reject PDF and PNG files with "Only CSV files are allowed".
  total++;
  const tempPdf = path.join(os.tmpdir(), `test_sample_${Date.now()}.pdf`);
  fs.writeFileSync(tempPdf, '%PDF-1.4 dummy pdf content');
  try {
    await parseAndValidateCSV(tempPdf, 'students');
    assert.fail('Should have rejected PDF file');
  } catch (err) {
    assert.strictEqual(err.message, 'Only CSV files are allowed');
    console.log('✅ [PASSED] Uploading PDF file displays "Only CSV files are allowed"');
    passed++;
  } finally {
    try { fs.unlinkSync(tempPdf); } catch {}
  }

  total++;
  const tempPng = path.join(os.tmpdir(), `test_sample_${Date.now()}.png`);
  fs.writeFileSync(tempPng, '\x89PNG\r\n\x1a\n dummy png content');
  try {
    await parseAndValidateCSV(tempPng, 'students');
    assert.fail('Should have rejected PNG file');
  } catch (err) {
    assert.strictEqual(err.message, 'Only CSV files are allowed');
    console.log('✅ [PASSED] Uploading PNG file displays "Only CSV files are allowed"');
    passed++;
  } finally {
    try { fs.unlinkSync(tempPng); } catch {}
  }

  // Verify valid CSV still works
  total++;
  const tempCsv = path.join(os.tmpdir(), `test_sample_${Date.now()}.csv`);
  fs.writeFileSync(tempCsv, 'enrollment_no,name,email,department,semester,program,enrolled_courses\n240101,Aarav Sharma,aarav@bmu.edu.in,CSE,4,B.Tech,CSE3005');
  try {
    const { validRows } = await parseAndValidateCSV(tempCsv, 'students');
    assert.strictEqual(validRows.length, 1);
    console.log('✅ [PASSED] Valid CSV file continues to parse and succeed cleanly');
    passed++;
  } catch (err) {
    assert.fail('Valid CSV should not fail: ' + err.message);
  } finally {
    try { fs.unlinkSync(tempCsv); } catch {}
  }

  // ---------------- FACULTY LOGIN CONSTRAINTS ----------------
  // 1.) Login with incorrect password: "Invalid credentials. Password incorrect."
  // 2.) Login with blank field: "Email and password are required"
  // 3.) Login with unregistered email: "Invalid credentials. User not found."
  // 4.) Correct password: "faculty123" for all faculty emails present in database.

  let [sampleFaculty] = await query('SELECT email FROM faculty LIMIT 1');
  if (sampleFaculty.length === 0) {
    const { hashPassword } = require('../utils/passwordHelper');
    const passHash = await hashPassword('faculty123');
    await query('INSERT INTO faculty (faculty_code, name, email, department, designation, max_duties) VALUES (?, ?, ?, ?, ?, ?)',
      ['TESTFAC01', 'Dr. Test Faculty', 'test.faculty@bmu.edu.in', 'CSE', 'Assistant Professor', 4]);
    await query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "FACULTY")',
      ['Dr. Test Faculty', 'test.faculty@bmu.edu.in', passHash]);
    [sampleFaculty] = await query('SELECT email FROM faculty LIMIT 1');
  }
  const facultyEmail = sampleFaculty[0].email;

  // Case 1: Faculty login with incorrect password
  total++;
  try {
    await authService.loginUser({ email: facultyEmail, password: 'wrongpassword' });
    assert.fail('Should have failed with incorrect password');
  } catch (err) {
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid credentials. Password incorrect.');
    console.log(`✅ [PASSED] Faculty login with incorrect password throws "Invalid credentials. Password incorrect."`);
    passed++;
  }

  // Case 1b: Faculty login with admin123 (which is NOT the faculty password)
  total++;
  try {
    await authService.loginUser({ email: facultyEmail, password: 'admin123' });
    assert.fail('Should have failed when faculty attempts password admin123');
  } catch (err) {
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid credentials. Password incorrect.');
    console.log(`✅ [PASSED] Faculty login with admin123 rejected with "Invalid credentials. Password incorrect."`);
    passed++;
  }

  // Case 2: Faculty login with blank field
  total++;
  try {
    await authService.loginUser({ email: '', password: '', role: 'FACULTY' });
    assert.fail('Should have failed on empty credentials');
  } catch (err) {
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.message, 'Email and password are required');
    console.log('✅ [PASSED] Faculty login with blank field throws "Email and password are required"');
    passed++;
  }

  // Case 3: Faculty login with unregistered email
  total++;
  try {
    await authService.loginUser({ email: 'unregistered.faculty.999@unknown.edu', password: 'faculty123', role: 'FACULTY' });
    assert.fail('Should have failed on unregistered email');
  } catch (err) {
    assert.strictEqual(err.statusCode, 401);
    assert.strictEqual(err.message, 'Invalid credentials. User not found.');
    console.log('✅ [PASSED] Faculty login with unregistered email throws "Invalid credentials. User not found."');
    passed++;
  }

  // Case 4: Faculty login with correct credentials (faculty123)
  total++;
  try {
    const res = await authService.loginUser({ email: facultyEmail, password: 'faculty123', role: 'FACULTY' });
    assert.ok(res.token, 'Token must be returned');
    assert.strictEqual(res.user.role, 'FACULTY');
    console.log(`✅ [PASSED] Faculty login with correct password "faculty123" succeeds for ${facultyEmail}`);
    passed++;
  } catch (err) {
    assert.fail('Faculty login with faculty123 should succeed: ' + err.message);
  }

  // Case 5: Admin login with correct password (admin123)
  total++;
  try {
    const res = await authService.loginUser({ email: 'admin@examsphere.edu', password: 'admin123', role: 'ADMIN' });
    assert.ok(res.token, 'Token must be returned');
    assert.strictEqual(res.user.role, 'ADMIN');
    console.log(`✅ [PASSED] Admin login with correct password "admin123" succeeds for admin@examsphere.edu`);
    passed++;
  } catch (err) {
    assert.fail('Admin login with admin123 should succeed: ' + err.message);
  }

  console.log('\n======================================================');
  console.log(`🎯 RESULT: ${passed} / ${total} TESTS PASSED`);
  console.log('======================================================\n');
  process.exit(0);
}

testRequirements().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
