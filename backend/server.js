const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { testConnection } = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');             // Module 1: Auth & RBAC
const masterDataRoutes = require('./routes/masterDataRoutes'); // Module 2: Master Data & Bulk CSV
const auditRoutes = require('./routes/auditRoutes');           // Module 11: Audit Logs & Stats
const schedulingRoutes = require('./routes/schedulingRoutes'); // Module 3: Exam Scheduling
const seatingRoutes = require('./routes/seatingRoutes');       // Module 4: Room & Seating Allocation
const dutyRoutes = require('./routes/dutyRoutes');             // Module 5: Faculty Duty Balancer
const invigilatorRoutes = require('./routes/invigilatorRoutes'); // Module 7: Invigilator Portal & Attendance
const incidentRoutes = require('./routes/incidentRoutes');     // Module 8: Exam-Day Incident Management
const facultyPortalRoutes = require('./routes/facultyPortalRoutes'); // Module 6: Faculty Portal & Doubt Resolution
const analyticsRoutes = require('./routes/analyticsRoutes');       // Module 10: Analytics & Reports
const notificationRoutes = require('./routes/notificationRoutes'); // Module 9: Notification & Alert System

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'ExamSphere Backend',
    timestamp: new Date().toISOString()
  });
});

// Mount module routes
app.use('/api/auth', authRoutes);             // Module 1: Auth & RBAC
app.use('/api/master-data', masterDataRoutes); // Module 2: Master Data & Bulk CSV
app.use('/api/admin', auditRoutes);           // Module 11: Audit Logs & Stats
app.use('/api/scheduling', schedulingRoutes); // Module 3: Scheduling & Timetable
app.use('/api/seating', seatingRoutes);       // Module 4: Anti-Cheating Seating
app.use('/api/allocations', seatingRoutes);   // Module 4: Room & Seating Allocation
app.use('/api/duty', dutyRoutes);             // Module 5: Faculty Duty Balancer
app.use('/api/faculty-portal', facultyPortalRoutes); // Module 6: Faculty Portal & Doubt Resolution
app.use('/api/faculty', facultyPortalRoutes);        // Module 6: Alias
app.use('/api/doubts', facultyPortalRoutes);         // Module 6: Alias
app.use('/api/invigilator', invigilatorRoutes); // Module 7: Invigilator Portal & Attendance
app.use('/api/incidents', incidentRoutes);    // Module 8: Exam-Day Incident Management
app.use('/api/analytics', analyticsRoutes);   // Module 10: Analytics & Reports
app.use('/api/notifications', notificationRoutes); // Module 9: Notification & Alert System


// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(` ExamSphere Backend Server running on port ${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log('====================================================');

  // Test MySQL connection on boot
  await testConnection();

  // Ensure all schema columns and tables are synchronized
  const { runMigration } = require('./database/migrate-schema');
  await runMigration().catch((e) => console.warn('Schema sync note:', e.message));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process.`);
    console.error(`💡 Tip: Free the port by running: lsof -ti :${PORT} | xargs kill -9`);
  } else {
    console.error('❌ Server startup error:', err.message);
  }
  process.exit(1);
});