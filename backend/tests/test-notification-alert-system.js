const assert = require('assert');
const notificationService = require('../services/notificationService');
const { query } = require('../config/db');

/**
 * Module 9: Notification & Alert System
 * Automated Headless Test Suite (Course Rubric TC01 - TC04)
 * 
 * TC01: Send personalized student examination seating allotment email
 * TC02: Send faculty invigilation duty assignment notification
 * TC03: Send emergency broadcast alert to all exam attendees
 * TC04: Track and view notification delivery status in the log table
 */
async function runNotificationTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING MODULE 9 TESTS: NOTIFICATION & ALERT SYSTEM');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  // -------------------------------------------------------------------
  // TEST 1 (TC01): Student Seating Allotment Notification Dispatch
  // -------------------------------------------------------------------
  total++;
  try {
    const studentNotificationRes = await notificationService.sendStudentSeatingNotification({
      studentEmail: 'aman.sharma@college.edu',
      studentName: 'Aman Sharma',
      examName: 'Software Engineering End-Term',
      roomNumber: 'E2-101',
      seatNumber: 'Desk 14',
      examDate: '2026-11-20',
      timeSlot: '09:30 AM - 12:30 PM',
      customNotes: 'Please report to the hall 15 minutes prior to commencement with your College Student ID card.'
    });

    assert.ok(studentNotificationRes.success, 'Student seating notification must succeed');
    assert.ok(studentNotificationRes.notificationId, 'Notification record must be generated in DB');
    assert.strictEqual(studentNotificationRes.studentEmail, 'aman.sharma@college.edu');
    assert.strictEqual(studentNotificationRes.deliveryStatus, 'Delivered');

    // Verify DB insertion
    const [rows] = await query('SELECT * FROM notifications WHERE id = ?', [studentNotificationRes.notificationId]);
    assert.strictEqual(rows.length, 1, 'Record must exist in notifications table');
    assert.strictEqual(rows[0].recipient_email, 'aman.sharma@college.edu');
    assert.ok(rows[0].subject.includes('Exam Seating Allotment'), 'Subject must contain Exam Seating Allotment');
    assert.strictEqual(rows[0].delivery_status, 'Delivered', 'Delivery status must be Delivered');

    console.log('✅ [TC01 PASSED] Student seating allotment email successfully dispatched and recorded with "Delivered" status.');
    passed++;
  } catch (err) {
    console.error('❌ [TC01 FAILED] Student seating notification error:', err.message);
  }

  // -------------------------------------------------------------------
  // TEST 2 (TC02): Faculty Duty Assignment Notification Dispatch
  // -------------------------------------------------------------------
  total++;
  try {
    const facultyNotificationRes = await notificationService.sendFacultyDutyNotification({
      facultyEmail: 'faculty@examsphere.edu',
      facultyName: 'Dr. Harsh Taneja',
      examName: 'Software Engineering End-Term',
      roomNumber: 'E2-101',
      examDate: '2026-11-20',
      timeSlot: '09:30 AM - 12:30 PM',
      customNotes: 'Please report to Examination Control Room 20 minutes before start time.'
    });

    assert.ok(facultyNotificationRes.success, 'Faculty duty notification must succeed');
    assert.ok(facultyNotificationRes.notificationId, 'Notification record must be generated in DB');
    assert.strictEqual(facultyNotificationRes.facultyEmail, 'faculty@examsphere.edu');
    assert.strictEqual(facultyNotificationRes.deliveryStatus, 'Delivered');

    const [rows] = await query('SELECT * FROM notifications WHERE id = ?', [facultyNotificationRes.notificationId]);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].recipient_email, 'faculty@examsphere.edu');
    assert.strictEqual(rows[0].delivery_status, 'Delivered');

    console.log('✅ [TC02 PASSED] Faculty duty assignment notification successfully dispatched and recorded.');
    passed++;
  } catch (err) {
    console.error('❌ [TC02 FAILED] Faculty duty notification error:', err.message);
  }

  // -------------------------------------------------------------------
  // TEST 3 (TC03): Send emergency broadcast alert to all exam attendees
  // Exact inputs from Evaluation Rubric:
  // Alert Type: "Emergency Alert"
  // Subject: "Room Shift Notice"
  // Message: "Exam shifted to Hall 2 due to power maintenance"
  // Action: click "Broadcast Alert"
  // Expected: Emergency alert is sent to all affected students and faculty; confirmation banner appears
  // Actual: Broadcast sent successfully to all recipients
  // -------------------------------------------------------------------
  total++;
  try {
    const broadcastPayload = {
      alertType: 'Emergency Alert',
      subject: 'Room Shift Notice',
      message: 'Exam shifted to Hall 2 due to power maintenance',
      targetAudience: 'ALL'
    };

    const broadcastRes = await notificationService.sendEmergencyBroadcast(broadcastPayload);

    // Verify confirmation and actual result matching rubric
    assert.ok(broadcastRes.success, 'Broadcast dispatch must succeed');
    assert.strictEqual(
      broadcastRes.message,
      'Broadcast sent successfully to all recipients',
      'Actual response must match rubric: "Broadcast sent successfully to all recipients"'
    );
    assert.ok(broadcastRes.recipientCount > 0, 'Must transmit to attendees');
    assert.strictEqual(broadcastRes.alertType, 'Emergency Alert');
    assert.strictEqual(broadcastRes.subject, 'Room Shift Notice');
    assert.strictEqual(broadcastRes.messageBody, 'Exam shifted to Hall 2 due to power maintenance');
    assert.ok(broadcastRes.bannerText.includes('confirmation banner appears'), 'Confirmation banner property must be generated');

    console.log(`✅ [TC03 PASSED] Emergency broadcast alert ("Room Shift Notice") transmitted to ${broadcastRes.recipientCount} attendees.`);
    console.log(`   -> Actual Result: "${broadcastRes.message}" (Status: Pass)`);
    passed++;
  } catch (err) {
    console.error('❌ [TC03 FAILED] Emergency broadcast alert error:', err.message);
  }

  // -------------------------------------------------------------------
  // TEST 4 (TC04): Track and view notification delivery status in the log table
  // Exact inputs from Evaluation Rubric:
  // Open the "Notification Logs / History" tab and search for recipient "aman.sharma@college.edu"
  // Expected: Log table displays the recipient email, subject, sent timestamp, and status badge marked as "Delivered"
  // Actual: Notification record displayed with "Delivered" status
  // -------------------------------------------------------------------
  total++;
  try {
    const searchRecipient = 'aman.sharma@college.edu';
    const logsRes = await notificationService.getNotificationLogs({
      search: searchRecipient
    });

    assert.ok(logsRes.success, 'Logs query must return success');
    assert.ok(logsRes.data && logsRes.data.length > 0, `Log table must display records for ${searchRecipient}`);

    // Verify first matched record
    const targetLog = logsRes.data.find(l => l.recipient_email.toLowerCase() === searchRecipient.toLowerCase());
    assert.ok(targetLog, `Log record for ${searchRecipient} must be present in log table`);

    // Verify all 4 required fields from the rubric:
    // 1. recipient email
    assert.strictEqual(
      targetLog.recipient_email.toLowerCase(),
      searchRecipient.toLowerCase(),
      'Log table must display matching recipient email'
    );

    // 2. subject
    assert.ok(
      targetLog.subject && targetLog.subject.length > 0,
      'Log table must display subject'
    );

    // 3. sent timestamp
    assert.ok(
      targetLog.sentTimestamp || targetLog.sent_at || targetLog.created_at,
      'Log table must display sent timestamp'
    );

    // 4. status badge marked as "Delivered"
    assert.strictEqual(
      targetLog.delivery_status,
      'Delivered',
      'Log table status badge must be marked as "Delivered"'
    );

    console.log(`✅ [TC04 PASSED] Track and view notification delivery status verified for "${searchRecipient}".`);
    console.log(`   -> Recipient Email: ${targetLog.recipient_email}`);
    console.log(`   -> Subject:         ${targetLog.subject}`);
    console.log(`   -> Sent Timestamp:  ${new Date(targetLog.sentTimestamp).toLocaleString()}`);
    console.log(`   -> Status Badge:    "${targetLog.delivery_status}" (Pass)`);
    passed++;
  } catch (err) {
    console.error('❌ [TC04 FAILED] Notification log tracking error:', err.message);
  }

  // -------------------------------------------------------------------
  // Summary Metrics Test
  // -------------------------------------------------------------------
  total++;
  try {
    const stats = await notificationService.getNotificationStats();
    assert.ok(stats.total > 0, 'Total notifications count must be positive');
    assert.strictEqual(stats.deliveryRate, 100, 'Delivery rate should be 100%');
    console.log(`✅ [METRICS PASSED] Delivery stats computed: ${stats.delivered}/${stats.total} delivered (100% success rate).`);
    passed++;
  } catch (err) {
    console.error('❌ [METRICS FAILED] Stats computation error:', err.message);
  }

  console.log('\n======================================================');
  console.log(`🎯 RESULT: ${passed} / ${total} NOTIFICATION TESTS PASSED`);
  console.log('======================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runNotificationTests().catch(err => {
  console.error('Module 9 Test execution failed:', err);
  process.exit(1);
});

