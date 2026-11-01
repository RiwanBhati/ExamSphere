import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatsGrid from './components/StatsGrid';
import MasterDataView from './components/MasterDataView';
import SeatingAllocationView from './components/SeatingAllocationView';
import ExamSchedulingView from './components/scheduling/ExamSchedulingView';
import FacultyDutyWorkloadView from './components/duty-management/FacultyDutyWorkloadView';
import ExamIncidentManagementView from './components/incident-management/ExamIncidentManagementView';
import InvigilatorPortalView from './components/InvigilatorPortalView';
import FacultyPortalView from './components/faculty/FacultyPortalView';
import PortalLoginView from './components/PortalLoginView';
import AdminAttendanceView from './components/AdminAttendanceView';
import AnalyticsReportsView from './components/AnalyticsReportsView';
import NotificationAlertSystemView from './components/notifications/NotificationAlertSystemView';
import { api } from './api';
import { Database, Users, FileText, Grid, Eye, Camera, Calendar, HelpCircle, BarChart3, Bell } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('master-data');
  const [facultyTab, setFacultyTab] = useState('invigilation');
  const [stats, setStats] = useState({
    students: 0,
    faculty: 0,
    courses: 0,
    rooms: 0,
    exams: 0,
    seatingCount: 0,
    dutyCount: 0,
    incidentCount: 0
  });

  const loadStats = async () => {
    try {
      const res = await api.getSystemSummary();
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.log('Stats fetch note:', err.message);
    }
  };

  useEffect(() => {
    // Purge any stale permanent localStorage sessions so opening website requires fresh sign-in
    try {
      localStorage.removeItem('examsphere_token');
      localStorage.removeItem('examsphere_user');
    } catch {}

    // Check active tab session in sessionStorage
    const savedUser = api.getUser();
    const savedToken = api.getToken();
    if (savedUser && savedToken && savedToken !== 'demo-jwt-token-active') {
      setUser(savedUser);
      if (savedUser.role === 'ADMIN') {
        loadStats();
      }
    } else {
      api.removeToken();
      setUser(null);
    }
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'ADMIN') {
      loadStats();
    }
    setActiveTab(loggedInUser.role === 'ADMIN' ? 'master-data' : 'doubts');
    setFacultyTab('doubts');
  };

  const handleLogout = () => {
    api.removeToken();
    setUser(null);
  };

  // 1. MUST LOG IN FIRST: If unauthenticated, show dedicated PortalLoginView
  if (!user) {
    return <PortalLoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. TEACHER / INVIGILATOR PORTAL: Dedicated workspace for faculty/invigilators
  if (user.role === 'FACULTY') {
    return (
      <div className="app-shell">
        <Navbar user={user} onLogout={handleLogout} />

        <main className="main-content" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '1.5rem 2rem' }}>
          <div className="nav-tabs" style={{ marginBottom: '1.5rem' }}>
            <button
              className={`tab-btn ${facultyTab === 'doubts' ? 'active' : ''}`}
              onClick={() => setFacultyTab('doubts')}
            >
              <HelpCircle size={16} />
              <span>Doubts</span>
            </button>

            <button
              className={`tab-btn ${facultyTab === 'invigilation' ? 'active' : ''}`}
              onClick={() => setFacultyTab('invigilation')}
            >
              <Eye size={16} />
              <span>Invigilation</span>
            </button>

            <button
              className={`tab-btn ${facultyTab === 'incident' ? 'active' : ''}`}
              onClick={() => setFacultyTab('incident')}
            >
              <FileText size={16} />
              <span>Incident report</span>
            </button>
          </div>

          {facultyTab === 'doubts' && (
            <FacultyPortalView user={user} />
          )}

          {facultyTab === 'invigilation' && (
            <InvigilatorPortalView user={user} onLogout={handleLogout} />
          )}

          {facultyTab === 'incident' && (
            <ExamIncidentManagementView user={user} />
          )}
        </main>
      </div>
    );
  }

  // 3. ADMINISTRATOR CONTROL PANEL: All administrator modules in end-to-end lifecycle order
  return (
    <div className="app-shell">
      <Navbar user={user} onLogout={handleLogout} />

      <main className="main-content">
        <StatsGrid stats={stats} />

        {/* Main admin navigation */}
        <div className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'master-data' ? 'active' : ''}`}
            onClick={() => setActiveTab('master-data')}
          >
            <Database size={16} />
            <span>Master data</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'scheduling' ? 'active' : ''}`}
            onClick={() => setActiveTab('scheduling')}
          >
            <Calendar size={16} />
            <span>Schedule</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'seating' ? 'active' : ''}`}
            onClick={() => setActiveTab('seating')}
          >
            <Grid size={16} />
            <span>Seating</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'duty-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('duty-management')}
          >
            <Users size={16} />
            <span>Faculty duties</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <Camera size={16} />
            <span>Attendance</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'incident-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('incident-management')}
          >
            <FileText size={16} />
            <span>Incidents</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={16} />
            <span>Notifications</span>
          </button>
        </div>

        {/* Dynamic Tab Views with Integrated Inter-Page Workflow Handlers */}
        {activeTab === 'master-data' && (
          <MasterDataView 
            user={user} 
            onDataChange={loadStats} 
            onNavigateToStep={setActiveTab} 
          />
        )}

        {activeTab === 'scheduling' && (
          <ExamSchedulingView 
            user={user} 
            onNavigateToStep={setActiveTab} 
          />
        )}

        {activeTab === 'seating' && (
          <SeatingAllocationView 
            user={user} 
            onNavigateToStep={setActiveTab} 
          />
        )}

        {activeTab === 'duty-management' && (
          <FacultyDutyWorkloadView 
            user={user} 
            onNavigateToStep={setActiveTab} 
          />
        )}

        {activeTab === 'attendance' && (
          <AdminAttendanceView 
            user={user} 
            onNavigateToStep={setActiveTab} 
          />
        )}

        {activeTab === 'incident-management' && (
          <ExamIncidentManagementView 
            user={user} 
            onNavigateToStep={setActiveTab} 
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsReportsView user={user} />
        )}

        {activeTab === 'notifications' && (
          <NotificationAlertSystemView user={user} />
        )}
      </main>
    </div>
  );
}
