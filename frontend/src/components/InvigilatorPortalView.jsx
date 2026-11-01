import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, getFullPhotoUrl } from '../api';
import {
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Download,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  ChevronRight,
  Eye,
  FileText,
  Check,
  LayoutGrid,
  List,
  Camera,
  RotateCcw,
  X,
  HelpCircle
} from 'lucide-react';
import RaiseDoubtModal from './faculty/RaiseDoubtModal';
import { useDemoTime } from '../context/DemoTimeContext';

export default function InvigilatorPortalView({ user }) {
  const { demoDate, demoTime, isSlotActive, formatDemoDate, formatDemoTime } = useDemoTime();
  const [activeSubTab, setActiveSubTab] = useState('duties'); // 'duties', 'verification'
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [duties, setDuties] = useState([]);
  const [selectedDutyId, setSelectedDutyId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [examRooms, setExamRooms] = useState([]);
  const [dutyDetails, setDutyDetails] = useState(null);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState(null);
  const [isRaiseDoubtOpen, setIsRaiseDoubtOpen] = useState(false);
  const [doubtStudent, setDoubtStudent] = useState(null);

  // Photo Capture Modal State (Real Webcam Snapshot)
  const [photoModalStudent, setPhotoModalStudent] = useState(null);
  const [capturedSnapshot, setCapturedSnapshot] = useState(null);
  const [cameraStreamActive, setCameraStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Fetch Duties for Logged-In Teacher / Faculty
  const loadDuties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getInvigilatorDuties(user?.facultyId || user?.faculty_id || user?.id);
      if (res.data) {
        const dutyList = Array.isArray(res.data) ? res.data : (res.data.duties || []);
        setDuties(dutyList);
        // Auto-select first duty if not selected
        if (dutyList.length > 0 && !selectedDutyId) {
          setSelectedDutyId(dutyList[0].id);
        }
      }
    } catch (err) {
      showToast(`Error fetching assigned duties: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDutyId]);

  useEffect(() => {
    loadDuties();
  }, [loadDuties]);

  // 2. Fetch Students for Selected Duty
  const loadDutyStudents = useCallback(async (dutyId, roomId = null) => {
    if (!dutyId) return;
    try {
      const res = await api.getDutyStudents(dutyId, roomId);
      if (res.data) {
        setDutyDetails(res.data.duty);
        setStudents(res.data.students || []);
        setStats(res.data.stats || null);
        if (res.data.examRooms) {
          setExamRooms(res.data.examRooms);
        }
      }
    } catch (err) {
      showToast(`Error fetching classroom roster: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    if (selectedDutyId) {
      loadDutyStudents(selectedDutyId, selectedRoomId);
    }
  }, [selectedDutyId, selectedRoomId, loadDutyStudents]);

  // 3. Confirm Duty Status
  const handleConfirmDuty = async (dutyId) => {
    setActionLoading(true);
    try {
      await api.confirmDuty(dutyId, 'CONFIRMED');
      showToast('Duty accepted and confirmed successfully.');
      setDuties((prev) =>
        prev.map((d) =>
          d.id === dutyId ? { ...d, status: 'CONFIRMED', duty_status: 'CONFIRMED' } : d
        )
      );
      if (dutyDetails && dutyDetails.id === dutyId) {
        setDutyDetails((prev) => ({ ...prev, status: 'CONFIRMED', duty_status: 'CONFIRMED' }));
      }
      await loadDuties();
    } catch (err) {
      showToast(`Failed to confirm duty: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Mark Individual Student Attendance (Camera for Present, Direct for Absent)
  const handleMarkAttendance = async (studentId, status) => {
    if (!dutyDetails) return;
    if (status === 'PRESENT') {
      const target = students.find((s) => s.student_id === studentId);
      if (target) {
        handleOpenPhotoCapture(target);
        return;
      }
    }
    try {
      await api.markAttendance({
        exam_id: dutyDetails.exam_id,
        student_id: studentId,
        room_id: dutyDetails.room_id,
        status,
        verification_method: 'MANUAL'
      });
      showToast(`Student marked as ${status}.`);
      await loadDutyStudents(selectedDutyId);
    } catch (err) {
      showToast(`Attendance error: ${err.message}`);
    }
  };

  // 5. Bulk Mark Attendance
  const handleBulkMark = async (status) => {
    if (!selectedDutyId) return;
    if (status === 'PRESENT') {
      showToast('Present attendance requires individual candidate camera photo.');
      return;
    }
    const remainingCount = students.filter(s => s.attendance_status !== 'PRESENT').length;
    if (remainingCount === 0) {
      showToast('All candidates in this room are already marked Present.');
      return;
    }
    if (!window.confirm(`Are you sure you want to mark remaining ${remainingCount} candidate(s) as ${status}? Candidates already marked Present will NOT be changed.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.bulkMarkAttendance({
        dutyId: selectedDutyId,
        roomId: selectedRoomId || dutyDetails?.room_id,
        status,
        verification_method: 'MANUAL'
      });
      showToast(`Successfully marked ${res.data?.count || 0} candidate(s) as ${status}.`);
      await loadDutyStudents(selectedDutyId);
    } catch (err) {
      showToast(`Bulk mark error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Reset Attendance for Classroom
  const handleResetAttendance = async () => {
    if (!selectedDutyId) return;
    if (!window.confirm('Reset all attendance marks for this classroom session? This cannot be undone.')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.resetDutyAttendance(selectedDutyId);
      showToast('Attendance register cleared. All students returned to unverified.');
      await loadDutyStudents(selectedDutyId);
    } catch (err) {
      showToast(`Reset error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. REAL PHOTO CAPTURE: Start Webcam
  const startCameraStream = async () => {
    setCameraError(null);
    setCameraStreamActive(false);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (e) {
            // handle play interruption safely
          }
        }
        setCameraStreamActive(true);
      } else {
        throw new Error('MediaDevices not available.');
      }
    } catch (err) {
      console.warn('Camera stream note:', err.message);
      setCameraError('Live webcam feed not accessible on this device. Please grant camera permissions.');
      setCameraStreamActive(false);
    }
  };

  // Stop Webcam Stream
  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraStreamActive(false);
  };

  // Open Photo Capture Dialog for student
  const handleOpenPhotoCapture = (student) => {
    setPhotoModalStudent(student);
    setCapturedSnapshot(null);
    setCameraError(null);
    setTimeout(() => {
      startCameraStream();
    }, 120);
  };

  // Close Photo Capture Dialog
  const handleClosePhotoCapture = () => {
    stopCameraStream();
    setPhotoModalStudent(null);
    setCapturedSnapshot(null);
    setCameraError(null);
  };

  // Snap Frame from Webcam
  const handleTakeSnapshot = () => {
    if (videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedSnapshot(dataUrl);
      stopCameraStream();
    }
  };

  // Retake Photo
  const handleRetakeSnapshot = () => {
    setCapturedSnapshot(null);
    startCameraStream();
  };

  // Save Real Clicked Photo to Server & Mark Student Present
  const handleSavePhotoAndMarkPresent = async () => {
    if (!photoModalStudent || !capturedSnapshot || !dutyDetails) return;
    setIsSavingPhoto(true);
    try {
      await api.markAttendance({
        exam_id: dutyDetails.exam_id,
        student_id: photoModalStudent.student_id,
        room_id: dutyDetails.room_id,
        status: 'PRESENT',
        verification_method: 'MANUAL',
        photo_base64: capturedSnapshot
      });
      showToast(`Real photo saved for ${photoModalStudent.student_name} & marked Present!`);
      handleClosePhotoCapture();
      await loadDutyStudents(selectedDutyId);
    } catch (err) {
      showToast(`Failed to save photo: ${err.message}`);
    } finally {
      setIsSavingPhoto(false);
    }
  };

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // 8. Export Attendance CSV
  const handleExportCSV = () => {
    if (!dutyDetails || students.length === 0) {
      showToast('No students to export.');
      return;
    }

    const headers = [
      'Seat Number',
      'Student Name',
      'Enrollment No',
      'Department',
      'Course Code',
      'Exam Name',
      'Room',
      'Attendance Status',
      'Verification Method',
      'Has Photo',
      'Marked At'
    ];

    const rows = students.map((st) => [
      `"${st.seat_number || 'N/A'}"`,
      `"${st.student_name || 'N/A'}"`,
      `"${st.enrollment_no || 'N/A'}"`,
      `"${st.student_department || 'N/A'}"`,
      `"${dutyDetails.course_code || 'N/A'}"`,
      `"${dutyDetails.exam_name || 'N/A'}"`,
      `"${dutyDetails.room_number || 'N/A'}"`,
      `"${st.attendance_status || 'UNVERIFIED'}"`,
      `"${st.verification_method || 'MANUAL'}"`,
      `"${st.photo_path ? 'YES' : 'NO'}"`,
      `"${st.marked_at ? new Date(st.marked_at).toLocaleString() : 'N/A'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${dutyDetails.room_number}_${dutyDetails.course_code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Attendance report exported to CSV.');
  };

  // Filter students
  const filteredStudents = students.filter((st) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      st.student_name?.toLowerCase().includes(q) ||
      st.enrollment_no?.toLowerCase().includes(q) ||
      st.seat_number?.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PRESENT') return st.attendance_status === 'PRESENT';
    if (statusFilter === 'ABSENT') return st.attendance_status === 'ABSENT';
    if (statusFilter === 'UNVERIFIED') return !st.attendance_status;
    return true;
  });

  const selectedDuty = duties.find((d) => d.id === selectedDutyId) || dutyDetails;

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-in-out' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 8px 30px rgba(6, 182, 212, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            color: '#fff',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.86rem',
            fontWeight: 600
          }}
        >
          <Sparkles size={16} color="var(--accent-cyan)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Portal Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(99, 102, 241, 0.08))',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
            }}
          >
            <Eye size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Teacher Invigilation & Attendance Portal
              </h2>
              <span
                className="badge badge-indigo"
                style={{
                  fontSize: '0.72rem',
                  background: 'rgba(6, 182, 212, 0.18)',
                  color: '#67e8f9',
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }}
              >
                Teacher Portal Live
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Logged in as <strong>{user?.name || 'Faculty Teacher'}</strong> {user?.department ? `(${user.department})` : ''} • Showing your individual assigned examination duties
            </p>
          </div>
        </div>

        {/* Selected Duty Badge */}
        {selectedDuty && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <Building2 size={16} color="var(--accent-cyan)" />
            <div style={{ fontSize: '0.78rem' }}>
              <div style={{ color: 'var(--text-muted)' }}>Selected Duty Room:</div>
              <strong style={{ color: 'var(--text-main)' }}>{selectedDuty.room_number || 'Room TBD'}</strong>
              <span style={{ color: 'var(--text-dim)', marginLeft: '0.35rem' }}>({selectedDuty.course_code})</span>
            </div>
          </div>
        )}
      </div>

      {/* Invigilator Portal Navigation Tabs (Duties & Verify/Mark Attendance) */}
      <div
        className="nav-tabs"
        style={{
          marginBottom: '1.5rem',
          background: 'rgba(0,0,0,0.35)',
          padding: '0.35rem',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <button
          className={`tab-btn ${activeSubTab === 'duties' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('duties')}
          style={{ fontSize: '0.84rem' }}
        >
          <Calendar size={16} />
          <span>My Assigned Duties ({duties.length})</span>
        </button>

        <button
          className={`tab-btn ${activeSubTab === 'verification' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('verification')}
          style={{ fontSize: '0.84rem' }}
        >
          <UserCheck size={16} />
          <span>Verify & Mark Attendance</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PAGE 1: VIEW ASSIGNED DUTIES */}
      {/* ========================================================= */}
      {activeSubTab === 'duties' && (
        <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
          {/* Metrics summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}
          >
            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Total Assigned Duties
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {duties.length}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                Confirmed Duties
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                {duties.filter((d) => (d.status || d.duty_status) === 'CONFIRMED').length}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--accent-amber)', fontWeight: 600 }}>
                Pending Confirmation
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.2rem' }}>
                {duties.filter((d) => (d.status || d.duty_status) !== 'CONFIRMED').length}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                Assigned Hall Rooms
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                {new Set(duties.map((d) => d.room_id)).size}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={13} color="#f87171" />
                <span>Live Active Now</span>
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>
                {duties.filter((d) => isSlotActive(d.exam_date, d.start_time, d.end_time)).length}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>At demo time {demoTime}</span>
            </div>
          </div>

          {/* Duties List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spinning" style={{ margin: '0 auto 0.75rem auto' }} />
                <span>Loading your assigned duties schedule...</span>
              </div>
            ) : duties.length === 0 ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Calendar size={36} color="var(--primary)" style={{ opacity: 0.5, margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  No Invigilation Duties Assigned Yet
                </h3>
                <p style={{ fontSize: '0.84rem', maxWidth: '420px', margin: '0 auto 1.25rem auto' }}>
                  You currently have no scheduled invigilation slots. Contact the Controller of Examinations for your duty schedule.
                </p>
              </div>
            ) : (
              duties.map((duty) => {
                const isSelected = duty.id === selectedDutyId;
                const isConfirmed = (duty.status || duty.duty_status) === 'CONFIRMED';

                return (
                  <div
                    key={duty.id}
                    className="card"
                    style={{
                      padding: '1.35rem 1.5rem',
                      background: isSelected ? 'rgba(6, 182, 212, 0.06)' : 'var(--bg-card)',
                      border: isSelected ? '1px solid rgba(6, 182, 212, 0.45)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '10px',
                          background: isConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isConfirmed ? '#10b981' : '#f59e0b',
                          flexShrink: 0
                        }}
                      >
                        <Building2 size={22} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span
                            className="badge badge-cyan"
                            style={{ fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.04em' }}
                          >
                            ROOM {duty.room_number}
                          </span>
                          <span
                            className={`badge ${isConfirmed ? 'badge-emerald' : 'badge-amber'}`}
                            style={{ fontSize: '0.7rem', fontWeight: 700 }}
                          >
                            {isConfirmed ? '✓ CONFIRMED' : '⏳ ASSIGNED - CONFIRMATION REQUIRED'}
                          </span>
                          {isSlotActive(duty.exam_date, duty.start_time, duty.end_time) && (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                border: '1px solid #f87171',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} />
                              LIVE ACTIVE NOW
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            Building: {duty.building || 'Main Block'}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.3rem 0 0.2rem 0' }}>
                          {duty.exam_name}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>Course: <strong style={{ color: 'var(--text-main)' }}>{duty.course_code}</strong> ({duty.course_name})</span>
                          <span>•</span>
                          <span>Dept: <strong style={{ color: 'var(--text-main)' }}>{duty.course_dept || duty.course_department || duty.faculty_department || 'General'}</strong></span>
                          <span>•</span>
                          <span>Capacity: <strong style={{ color: 'var(--text-main)' }}>{duty.capacity || duty.room_capacity || 30} Candidates</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.45rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Calendar size={13} color="var(--accent-cyan)" />
                            {duty.exam_date ? new Date(duty.exam_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={13} color="var(--primary)" />
                            {duty.start_time?.slice(0, 5)} - {duty.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {!isConfirmed && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleConfirmDuty(duty.id)}
                          disabled={actionLoading}
                          style={{
                            background: 'var(--accent-emerald)',
                            borderColor: 'var(--accent-emerald)',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <Check size={14} />
                          <span>Accept & Confirm Duty</span>
                        </button>
                      )}

                      <button
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setSelectedDutyId(duty.id);
                          setActiveSubTab('verification');
                          showToast(`Opened attendance register for Room ${duty.room_number}.`);
                        }}
                        style={{
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: isSelected ? 'var(--primary)' : undefined
                        }}
                      >
                        <UserCheck size={14} />
                        <span>Verify & Mark Attendance</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PAGE 2: VERIFY & MARK ATTENDANCE (MERGED UNIFIED PAGE) */}
      {/* ========================================================= */}
      {activeSubTab === 'verification' && (
        <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
          {/* Duty Confirmation Alert if not yet confirmed */}
          {((dutyDetails?.status || selectedDuty?.status) !== 'CONFIRMED') && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15))',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderRadius: '12px',
              padding: '0.9rem 1.25rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={22} color="#fbbf24" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#fbbf24', fontSize: '0.9rem' }}>
                    Invigilation Duty Confirmation Required
                  </strong>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#fde68a' }}>
                    Please accept and confirm your invigilation assignment for Room {dutyDetails?.room_number || selectedDuty?.room_number} to officially report for duty.
                  </p>
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleConfirmDuty(selectedDutyId || dutyDetails?.id)}
                disabled={actionLoading}
                style={{
                  background: 'var(--accent-emerald)',
                  borderColor: 'var(--accent-emerald)',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem'
                }}
              >
                <Check size={15} />
                <span>{actionLoading ? 'Confirming...' : 'Accept & Confirm Duty'}</span>
              </button>
            </div>
          )}

          {/* Active Session & Batch Attendance Header Card */}
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(17, 24, 39, 0.85))',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-cyan" style={{ fontSize: '0.74rem', fontWeight: 800 }}>
                    ACTIVE SESSION: ROOM {dutyDetails?.room_number || selectedDuty?.room_number}
                  </span>
                  <span className="badge badge-indigo" style={{ fontSize: '0.72rem' }}>
                    {dutyDetails?.course_code || selectedDuty?.course_code}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.3rem 0 0.15rem 0' }}>
                  {dutyDetails?.exam_name || selectedDuty?.exam_name}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Exam Hall: <strong>{dutyDetails?.building || 'Main Block'}</strong> • Room Capacity: <strong>{dutyDetails?.capacity || 30} Candidates</strong>
                </div>
              </div>

              {/* Duty & Room Hall Selector Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                {duties.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Duty:</span>
                    <select
                      value={selectedDutyId || ''}
                      onChange={(e) => {
                        const newId = Number(e.target.value);
                        setSelectedDutyId(newId);
                        setSelectedRoomId(null);
                      }}
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-subtle)',
                        padding: '0.4rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        fontWeight: 600
                      }}
                    >
                      {duties.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.course_code} - Room {d.room_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Switch Hall:</span>
                  <select
                    value={selectedRoomId || dutyDetails?.room_id || ''}
                    onChange={(e) => {
                      const rId = Number(e.target.value);
                      setSelectedRoomId(rId);
                    }}
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    {examRooms && examRooms.length > 0 ? (
                      examRooms.map((rm) => (
                        <option key={rm.room_id} value={rm.room_id}>
                          Room {rm.room_number} ({rm.student_count || 0} students)
                        </option>
                      ))
                    ) : (
                      duties.map((d) => (
                        <option key={d.id} value={d.room_id}>
                          Room {d.room_number} - {d.course_code}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 700 }}>TOTAL STUDENTS</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats?.totalStudents || 0}</div>
              </div>

              <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>PRESENT</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#34d399' }}>{stats?.presentCount || 0}</div>
              </div>

              <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--accent-rose)', fontWeight: 700 }}>ABSENT</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fb7185' }}>{stats?.absentCount || 0}</div>
              </div>

              <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>PENDING</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>{stats?.unverifiedCount || 0}</div>
              </div>
            </div>

            {/* Integrated Batch Attendance Controls */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--accent-cyan)',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Camera size={13} />
                  <span>Camera Attendance Only (Snap candidate photo to mark present)</span>
                </span>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleBulkMark('ABSENT')}
                  disabled={actionLoading}
                  style={{ fontSize: '0.78rem', color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.35)' }}
                >
                  <XCircle size={13} />
                  <span>Mark Remaining Absent</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={handleExportCSV}
                  style={{ fontSize: '0.78rem' }}
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setDoubtStudent(null);
                    setIsRaiseDoubtOpen(true);
                  }}
                  style={{
                    fontSize: '0.78rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#fbbf24',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  title="Submit a student doubt from this classroom and request subject faculty support via email"
                >
                  <HelpCircle size={14} />
                  <span>Request Doubt Support (Call Faculty)</span>
                </button>
              </div>

              <button
                className="btn btn-secondary"
                onClick={handleResetAttendance}
                disabled={actionLoading}
                style={{ fontSize: '0.74rem', color: 'var(--text-dim)', borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <span>Reset Roster Marks</span>
              </button>
            </div>
          </div>

          {/* Search, Filter & View Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.85rem',
              marginBottom: '1rem'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
              <Search size={14} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search candidate by name, roll no, seat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.45rem 0.85rem 0.45rem 2.2rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            {/* Status Filter Pills & View Mode */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                {['ALL', 'PRESENT', 'ABSENT', 'UNVERIFIED'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    style={{
                      background: statusFilter === f ? 'var(--primary)' : 'transparent',
                      color: statusFilter === f ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.3rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                <button
                  onClick={() => setViewMode('cards')}
                  style={{
                    background: viewMode === 'cards' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: viewMode === 'cards' ? 'var(--text-main)' : 'var(--text-dim)',
                    border: 'none',
                    padding: '0.3rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                  title="Card View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  style={{
                    background: viewMode === 'table' ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: viewMode === 'table' ? 'var(--text-main)' : 'var(--text-dim)',
                    border: 'none',
                    padding: '0.3rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                  title="Table View"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Student Roster View: Cards vs Table */}
          {filteredStudents.length === 0 ? (
            <div className="card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} color="var(--primary)" style={{ opacity: 0.5, margin: '0 auto 0.75rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No student records matched your search query or filter.</p>
            </div>
          ) : viewMode === 'cards' ? (
            /* CARDS GRID VIEW */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filteredStudents.map((st) => {
                const isPresent = st.attendance_status === 'PRESENT';
                const isAbsent = st.attendance_status === 'ABSENT';
                const realPhotoUrl = getFullPhotoUrl(st.photo_path);

                return (
                  <div
                    key={st.student_id}
                    className="card"
                    style={{
                      padding: '1.15rem',
                      background: isPresent
                        ? 'rgba(16, 185, 129, 0.05)'
                        : isAbsent
                        ? 'rgba(244, 63, 94, 0.05)'
                        : 'var(--bg-card)',
                      border: isPresent
                        ? '1px solid rgba(16, 185, 129, 0.35)'
                        : isAbsent
                        ? '1px solid rgba(244, 63, 94, 0.35)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.85rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>
                      {/* Top Seat + Status pill */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span className="badge badge-emerald" style={{ fontWeight: 800, fontSize: '0.78rem' }}>
                          🪑 {st.seat_number || 'Seat TBD'}
                        </span>

                        <span
                          className={`badge ${
                            isPresent ? 'badge-emerald' : isAbsent ? 'badge-rose' : 'badge-gray'
                          }`}
                        >
                          {isPresent ? (st.photo_path ? '✓ Photo Verified' : 'Verified Present') : isAbsent ? 'Marked Absent' : 'Unverified'}
                        </span>
                      </div>

                      {/* Student info + Photo Thumbnail */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {realPhotoUrl ? (
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '2px solid var(--accent-cyan)',
                              boxShadow: '0 0 10px rgba(6, 182, 212, 0.3)',
                              flexShrink: 0
                            }}
                          >
                            <img
                              src={realPhotoUrl}
                              alt={st.student_name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              background: isPresent
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 182, 212, 0.3))'
                                : 'rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              color: isPresent ? '#34d399' : 'var(--text-main)',
                              border: '1px solid var(--border-subtle)',
                              flexShrink: 0
                            }}
                          >
                            {st.student_name?.charAt(0) || 'S'}
                          </div>
                        )}

                        <div style={{ overflow: 'hidden' }}>
                          <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.student_name}
                          </h4>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Roll: <strong style={{ color: 'var(--accent-cyan)' }}>{st.enrollment_no}</strong> • {st.student_department} ({st.program || 'B.Tech'})
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {st.student_email || `${st.enrollment_no.toLowerCase()}@bmu.edu.in`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Marking & Real Photo Capture Buttons */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                        <span>MARK ATTENDANCE:</span>
                        {st.marked_at && (
                          <span>{new Date(st.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>

                      {/* Primary Attendance Action: Camera Only */}
                      {isPresent && st.photo_path ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.35rem', marginBottom: '0.35rem' }}>
                          <div
                            style={{
                              padding: '0.45rem 0.6rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#34d399',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>✓ Verified Present</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenPhotoCapture(st)}
                            style={{
                              padding: '0.45rem 0.6rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(6, 182, 212, 0.4)',
                              background: 'rgba(6, 182, 212, 0.12)',
                              color: '#67e8f9',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            title="Retake candidate photo with camera"
                          >
                            <Camera size={13} />
                            <span>Retake</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPhotoCapture(st)}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.6rem',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(6, 182, 212, 0.5)',
                              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.22), rgba(59, 130, 246, 0.22))',
                              color: '#67e8f9',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                              boxShadow: '0 2px 8px rgba(6, 182, 212, 0.15)'
                            }}
                            title="Open camera to capture candidate photo and mark attendance"
                          >
                            <Camera size={15} />
                            <span>📸 Mark Present (Camera)</span>
                          </button>
                        </div>
                      )}

                      {/* Mark Absent */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleMarkAttendance(st.student_id, 'ABSENT')}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid rgba(244, 63, 94, 0.4)',
                            background: isAbsent ? 'rgba(244, 63, 94, 0.3)' : 'rgba(244, 63, 94, 0.08)',
                            color: isAbsent ? '#fff' : 'var(--accent-rose)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <XCircle size={13} />
                          <span>Mark Absent</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE ROSTER VIEW */
            <div className="card" style={{ padding: '0.5rem', overflowX: 'auto', background: 'var(--bg-card)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem', width: '60px' }}>Photo</th>
                    <th style={{ padding: '0.75rem', width: '90px' }}>Roll No</th>
                    <th style={{ padding: '0.75rem' }}>Candidate</th>
                    <th style={{ padding: '0.75rem' }}>Seat Number</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem' }}>Marked Time</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st) => {
                    const isPresent = st.attendance_status === 'PRESENT';
                    const isAbsent = st.attendance_status === 'ABSENT';
                    const realPhotoUrl = getFullPhotoUrl(st.photo_path);

                    return (
                      <tr key={st.student_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          {realPhotoUrl ? (
                            <img
                              src={realPhotoUrl}
                              alt={st.student_name}
                              style={{ width: 36, height: 36, borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--accent-cyan)' }}
                            />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                              <Camera size={14} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                          {st.enrollment_no}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <strong style={{ color: 'var(--text-main)', display: 'block' }}>{st.student_name}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                            {st.student_department} • {st.program || 'B.Tech'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span className="badge badge-emerald" style={{ fontWeight: 700, fontSize: '0.74rem' }}>
                            🪑 {st.seat_number || 'TBD'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span
                            className={`badge ${
                              isPresent ? 'badge-emerald' : isAbsent ? 'badge-rose' : 'badge-gray'
                            }`}
                          >
                            {st.attendance_status || 'UNVERIFIED'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                          {st.marked_at ? new Date(st.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            {isPresent && st.photo_path ? (
                              <button
                                onClick={() => handleOpenPhotoCapture(st)}
                                title="Retake candidate photo with camera"
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid rgba(16, 185, 129, 0.45)',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#34d399',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <CheckCircle2 size={12} />
                                <span>Verified (Retake)</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenPhotoCapture(st)}
                                title="Snap candidate photo with camera and mark present"
                                style={{
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid rgba(6, 182, 212, 0.5)',
                                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.22), rgba(59, 130, 246, 0.22))',
                                  color: '#67e8f9',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <Camera size={12} />
                                <span>📸 Mark Present</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleMarkAttendance(st.student_id, 'ABSENT')}
                              title="Mark Absent"
                              style={{
                                padding: '0.25rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(244, 63, 94, 0.35)',
                                background: isAbsent ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                                color: isAbsent ? '#fff' : 'var(--accent-rose)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Absent
                            </button>

                            <button
                              onClick={() => {
                                setDoubtStudent({ id: st.student_id, enrollment_no: st.enrollment_no, name: st.student_name });
                                setIsRaiseDoubtOpen(true);
                              }}
                              title="Raise student question doubt"
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(245, 158, 11, 0.45)',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#fbbf24',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <HelpCircle size={11} />
                              <span>Doubt</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* REAL PHOTO CAPTURE MODAL (INVIGILATOR LIVE WEBCAM SNAP) */}
      {/* ========================================================= */}
      {photoModalStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
          onClick={handleClosePhotoCapture}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              background: '#0d1322',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              borderRadius: '18px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(6, 182, 212, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.4rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.8)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '8px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)'
                  }}
                >
                  <Camera size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Capture Candidate Photo
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {photoModalStudent.student_name} • Roll: <span style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>{photoModalStudent.enrollment_no}</span> (Seat: {photoModalStudent.seat_number})
                  </div>
                </div>
              </div>

              <button
                onClick={handleClosePhotoCapture}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Viewfinder */}
            <div style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  width: '100%',
                  height: 320,
                  borderRadius: '14px',
                  background: '#040711',
                  border: '2px solid rgba(6, 182, 212, 0.45)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {capturedSnapshot ? (
                  /* Preview of snapped photo */
                  <img
                    src={capturedSnapshot}
                    alt="Captured candidate"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#070c18' }}
                  />
                ) : (
                  /* Live webcam feed */
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: cameraStreamActive ? 'block' : 'none'
                      }}
                    />

                    {!cameraStreamActive && (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        <Camera size={40} color="var(--accent-cyan)" style={{ opacity: 0.7, marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.84rem', margin: '0 0 0.75rem' }}>
                          {cameraError || 'Initializing live camera feed...'}
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={startCameraStream}
                          style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <RefreshCw size={14} />
                          <span>Retry Camera Connection</span>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Hidden canvas for taking snapshot */}
                <canvas ref={canvasRef} style={{ display: 'none' }} width={640} height={480} />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                {!capturedSnapshot ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleTakeSnapshot}
                    disabled={!cameraStreamActive}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      background: cameraStreamActive ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      borderRadius: '8px',
                      cursor: cameraStreamActive ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <Camera size={18} />
                    <span>📸 Snap Photo Now</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSavePhotoAndMarkPresent}
                      disabled={isSavingPhoto}
                      style={{
                        flex: 2,
                        padding: '0.65rem',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        background: 'var(--accent-emerald)',
                        borderColor: 'var(--accent-emerald)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <Check size={16} />
                      <span>{isSavingPhoto ? 'Saving Real Photo...' : '✓ Save Photo & Mark Present'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRetakeSnapshot}
                      disabled={isSavingPhoto}
                      style={{ flex: 1, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                    >
                      <RotateCcw size={14} />
                      <span>Retake</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Doubt Resolution Modal */}
      <RaiseDoubtModal
        isOpen={isRaiseDoubtOpen}
        onClose={() => {
          setIsRaiseDoubtOpen(false);
          setDoubtStudent(null);
        }}
        onSuccess={() => {
          showToast('Student doubt submitted and email alert dispatched to subject faculty!');
        }}
        currentExam={dutyDetails ? { id: dutyDetails.exam_id, exam_name: dutyDetails.exam_name, course_code: dutyDetails.course_code } : selectedDuty}
        currentRoom={(() => {
          const activeRoomId = selectedRoomId || dutyDetails?.room_id || selectedDuty?.room_id;
          const roomObj = examRooms.find(r => Number(r.room_id) === Number(activeRoomId));
          return roomObj
            ? { id: roomObj.room_id, room_number: roomObj.room_number, building: roomObj.building }
            : dutyDetails
              ? { id: dutyDetails.room_id, room_number: dutyDetails.room_number, building: dutyDetails.building }
              : selectedDuty
                ? { id: selectedDuty.room_id, room_number: selectedDuty.room_number, building: selectedDuty.building }
                : null;
        })()}
        invigilatorUser={{
          ...user,
          name: dutyDetails?.invigilator_name || dutyDetails?.faculty_name || selectedDuty?.faculty_name || selectedDuty?.teacher_name || user?.name || 'Exam Hall Invigilator',
          faculty_id: dutyDetails?.faculty_id || selectedDuty?.faculty_id || user?.faculty_id || user?.id
        }}
        initialStudent={doubtStudent}
        classroomStudents={students}
      />
    </div>
  );
}
