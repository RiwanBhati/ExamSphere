const { query } = require('../config/db');
const emailService = require('./emailService');

class BroadcastService {
  async sendRoomChange({ recipientEmail, roomNumber, examName, details, senderEmail }) {
    const recipient = String(recipientEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      const error = new Error('Enter one valid recipient email address.');
      error.statusCode = 400;
      throw error;
    }
    const room = String(roomNumber || '').trim();
    if (!room) {
      const error = new Error('New emergency room is required.');
      error.statusCode = 400;
      throw error;
    }
    const subject = `URGENT: Emergency room change${examName ? ` - ${examName}` : ''}`;
    const message = [
      'Emergency examination room change',
      examName ? `Examination: ${examName}` : null,
      `New room: ${room}`,
      details ? `Details: ${details}` : null,
      'Please proceed to the new room immediately.'
    ].filter(Boolean).join('\n');

    let logId;
    const [insert] = await query(
      `INSERT INTO broadcast_logs (recipient_email, subject, message, delivery_status, sent_by_email)
       VALUES (?, ?, ?, 'PENDING', ?)`,
      [recipient, subject, message, senderEmail || null]
    );
    logId = insert.insertId;

    const delivery = await emailService.sendEmail({
      to: recipient,
      subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
      channel: 'FACULTY',
      senderName: 'Exam Controller Administration',
      extraParams: { room_number: room, emergency: 'true', exam_name: examName || '' }
    });
    const status = delivery.isRealEmailJs && delivery.success ? 'SENT' : delivery.success ? 'PENDING' : 'FAILED';
    const errorMessage = delivery.error || (status === 'PENDING' ? 'Email provider is not configured; message was logged but not sent.' : null);
    await query(
      `UPDATE broadcast_logs SET delivery_status = ?, provider = ?, error_message = ?, sent_at = ? WHERE id = ?`,
      [status, delivery.provider || null, errorMessage, status === 'SENT' ? new Date() : null, logId]
    );
    return { id: logId, recipient_email: recipient, subject, message, delivery_status: status, provider: delivery.provider || null, error_message: errorMessage, created_at: new Date().toISOString(), sent_at: status === 'SENT' ? new Date().toISOString() : null };
  }

  async getLogs() {
    const [rows] = await query('SELECT * FROM broadcast_logs ORDER BY id DESC LIMIT 200');
    return rows;
  }
}

module.exports = new BroadcastService();
