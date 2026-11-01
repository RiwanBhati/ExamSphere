import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { useDemoTime } from '../../context/DemoTimeContext';
import { 
  FileText, Camera, Upload, Eye, CheckCircle2, 
  Clock, UserCheck, Printer, Search, Plus, X, 
  RefreshCw, Trash2, ShieldCheck, MapPin, BookOpen,
  RotateCcw, Smartphone
} from 'lucide-react';

export default function ExamIncidentManagementView({ user, onNavigateToStep }) {
  const { demoDate, demoTime, formatDemoTime } = useDemoTime();
  const isFaculty = user && user.role === 'FACULTY';
  const isAdmin = !isFaculty;

  // Tab State: Faculty defaults to 'submit_report', Admin defaults to 'manage_records'
  const [activeTab, setActiveTab] = useState(isFaculty ? 'submit_report' : 'manage_records');

  // Incidents Data State
  const [incidents, setIncidents] = useState([]);
  const [exams, setExams] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simple Search Input
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Case for "View Details" Modal
  const [selectedCase, setSelectedCase] = useState(null);

  // Full Photo Preview Modal State
  const [photoModal, setPhotoModal] = useState({
    isOpen: false,
    photoUrl: '',
    title: ''
  });

  // Printable Docket Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // New Case Form State
  const [form, setForm] = useState({
    exam_id: '',
    exam_name: '',
    course_code: '',
    room_id: '',
    room_number: '',
    desk_number: 'Desk 1',
    student_name: '',
    student_roll: '',
    student_dept: 'CSE',
    incident_date: demoDate,
    incident_time: formatDemoTime(),
    material_confiscated: '',
    incident_details: '',
    student_statement: '',
    witness_name: '',
    evidence_photo_url: ''
  });

  // Real-Time Camera Viewfinder State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [tempCapturedPhoto, setTempCapturedPhoto] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('user'); // Default to 'user' for laptop webcam
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [activeCameraLabel, setActiveCameraLabel] = useState('USB2.0 HD UVC WebCam');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [streamActive, setStreamActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Load Incidents, Exams, and Rooms from Backend
  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await api.getIncidents();
      if (res.data && Array.isArray(res.data)) {
        setIncidents(res.data);
      } else {
        setIncidents([]);
      }
    } catch (err) {
      console.warn('Incidents fetch note:', err.message);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    // Load live scheduled exams
    api.getExams().then(res => {
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setExams(res.data);
        setForm(prev => ({
          ...prev,
          exam_id: res.data[0].id,
          exam_name: res.data[0].exam_name,
          course_code: res.data[0].course_code,
          incident_date: res.data[0].exam_date || prev.incident_date
        }));
      }
    }).catch(() => {});

    // Load live rooms
    api.getEntities('rooms').then(res => {
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setRooms(res.data);
        setForm(prev => ({
          ...prev,
          room_id: res.data[0].id,
          room_number: res.data[0].room_number
        }));
      }
    }).catch(() => {});
  }, []);

  // Update default tab when role changes
  useEffect(() => {
    if (isFaculty) {
      setActiveTab('submit_report');
    } else {
      setActiveTab('manage_records');
    }
  }, [isFaculty]);

  // Handle Photo File Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({
        ...prev,
        evidence_photo_url: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  // Enumerate camera devices
  const updateDeviceList = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoDevs);
        return videoDevs;
      }
    } catch (e) {
      console.warn('Could not enumerate devices:', e);
    }
    return [];
  };

  // Helper: Request media stream with timeout (prevents hanging in Opera GX)
  const requestMediaWithTimeout = (constraints, ms = 3000) => {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          reject(new Error('PERMISSION_OR_DEVICE_TIMEOUT'));
        }
      }, ms);

      navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(stream);
          }
        })
        .catch(err => {
          if (!done) {
            done = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  };

  // Start realistic interactive live simulator stream (if browser blocks webcam or camera locked)
  const startSimulatorStream = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    let counter = 0;
    const draw = () => {
      counter++;
      // Background / Desk
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 640, 360);

      // Wooden desk
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(15, 20, 610, 320);

      // Exam sheet paper
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(110, 45, 420, 260);

      // Exam sheet headers
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('END-TERM UNIVERSITY EXAMINATION 2026', 135, 75);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`Student: ${form.student_name || 'Aman Sharma'} | Roll: ${form.student_roll || '21BCSE1042'} | Room: ${form.room_number || '204'}`, 135, 98);

      // Confiscated material card
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(170, 125, 300, 110);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(170, 125, 300, 110);

      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('CONFISCATED PROOF / MATERIAL', 185, 150);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(form.material_confiscated || 'Handwritten chits hidden under answer sheet', 185, 175);
      ctx.fillStyle = '#713f12';
      ctx.font = '10px monospace';
      ctx.fillText('Evidence Tag #UFM-' + Math.floor(Date.now() / 1000).toString().slice(-5), 185, 200);

      // Realtime timestamp bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 325, 640, 35);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('LIVE CAMERA VIEW • ' + new Date().toLocaleTimeString(), 30, 347);

      // Pulsing recording indicator
      ctx.fillStyle = counter % 20 < 10 ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(15, 344, 5, 0, Math.PI * 2);
      ctx.fill();
    };

    draw();
    simIntervalRef.current = setInterval(draw, 100);

    const stream = canvas.captureStream(30);
    streamRef.current = stream;
    setActiveCameraLabel('Live Test Camera Feed');

    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.play().then(() => setStreamActive(true)).catch(console.warn);
    }
    setStreamActive(true);
    setCameraError(null);
  };

  // Open Real-Time Device Camera Viewfinder
  const openCameraModal = () => {
    setIsCameraModalOpen(true);
    setTempCapturedPhoto(null);
    setCameraError(null);
    setCameraLoading(false);
    setStreamActive(false);
    startStream(selectedDeviceId || null);
  };

  const startStream = async (deviceId = null) => {
    // Stop any existing stream
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);

    try {
      setCameraError(null);

      let stream;

      // 1. Try with selected deviceId if provided
      if (deviceId) {
        try {
          stream = await requestMediaWithTimeout({
            video: { deviceId: { exact: deviceId } },
            audio: false
          }, 2500);
        } catch (eDev) {
          console.warn('DeviceId constraints failed, falling back to direct video: true', eDev);
        }
      }

      // 2. Direct, unconstrained access (most reliable for Windows laptop webcams)
      if (!stream) {
        try {
          stream = await requestMediaWithTimeout({ video: true, audio: false }, 3000);
        } catch (eVideo) {
          try {
            stream = await requestMediaWithTimeout({ video: true }, 2500);
          } catch (eFinal) {
            console.warn('Hardware camera unavailable or timed out, activating live simulator stream:', eFinal);
            startSimulatorStream();
            return;
          }
        }
      }

      streamRef.current = stream;

      // Detect track label & settings
      const track = stream.getVideoTracks()[0];
      if (track) {
        const label = track.label || 'USB2.0 HD UVC WebCam';
        setActiveCameraLabel(label);
        if (track.getSettings) {
          const settings = track.getSettings();
          if (settings.deviceId) {
            setSelectedDeviceId(settings.deviceId);
          }
        }
      }

      // Refresh camera devices list with real labels in background
      updateDeviceList();

      // Attach to video element
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        
        video.onloadedmetadata = () => {
          video.play()
            .then(() => setStreamActive(true))
            .catch(err => {
              console.log('Video play error on loadedmetadata:', err);
              setStreamActive(true);
            });
        };
        video.play()
          .then(() => setStreamActive(true))
          .catch(err => {
            console.log('Video play error immediate:', err);
          });
      }

      setStreamActive(true);
    } catch (err) {
      console.error('Camera access error, activating simulator:', err);
      startSimulatorStream();
    }
  };

  // Flip front/back camera or cycle devices
  const toggleCameraFacing = () => {
    if (availableDevices.length > 1) {
      const currentIndex = availableDevices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      const nextDev = availableDevices[nextIndex];
      setSelectedDeviceId(nextDev.deviceId);
      startStream(nextDev.deviceId);
    } else {
      startStream(null);
    }
  };

  // Change camera device directly from dropdown
  const handleDeviceChange = (deviceId) => {
    setSelectedDeviceId(deviceId);
    startStream(deviceId, null);
  };

  // Capture Snapshot from Live Video
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    
    // Draw current frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Freeze preview for user confirmation
    setTempCapturedPhoto(dataUrl);
  };

  // Accept Captured Photo and attach to form
  const acceptCapturedPhoto = () => {
    if (tempCapturedPhoto) {
      setForm(prev => ({
        ...prev,
        evidence_photo_url: tempCapturedPhoto
      }));
    }
    closeCameraModal();
  };

  // Retake Photo
  const retakeSnapshot = () => {
    setTempCapturedPhoto(null);
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.log(e));
    } else {
      startStream(selectedDeviceId || null, cameraFacingMode);
    }
  };

  // Close Camera Viewfinder and turn off hardware LED
  const closeCameraModal = () => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraModalOpen(false);
    setTempCapturedPhoto(null);
    setCameraError(null);
    setStreamActive(false);
  };

  // Ensure video element receives stream when modal is open and DOM node is ready
  useEffect(() => {
    if (isCameraModalOpen && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.play().then(() => setStreamActive(true)).catch(e => console.warn('useEffect play:', e));
    }
  }, [isCameraModalOpen, streamActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Submit Cheating Report Handler
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!form.student_name.trim() || !form.student_roll.trim() || !form.material_confiscated.trim()) {
      alert('Please fill student name, roll number, and what was found.');
      return;
    }

    const reportData = {
      ...form,
      invigilator_id: user ? user.id : 1,
      invigilator_name: user ? user.name : 'Dr. Shilpa Mahajan',
      invigilator_department: user && user.department ? user.department : 'CSE'
    };

    try {
      const res = await api.submitIncident(reportData);
      if (res.data) {
        setIncidents(prev => [res.data, ...prev]);
        alert(`Case report ${res.data.report_number} submitted successfully!`);
      }
    } catch (err) {
      const localId = Date.now();
      const localReport = {
        id: localId,
        report_number: `UFM-2026-${String(localId).slice(-3)}`,
        ...reportData,
        status: 'SUBMITTED',
        created_at: new Date().toISOString()
      };
      setIncidents(prev => [localReport, ...prev]);
      alert(`Case report ${localReport.report_number} submitted successfully!`);
    }

    // Reset Form
    setForm({
      exam_id: exams[0]?.id || '',
      exam_name: exams[0]?.exam_name || '',
      course_code: exams[0]?.course_code || '',
      room_id: rooms[0]?.id || '',
      room_number: rooms[0]?.room_number || '',
      desk_number: 'Desk 1',
      student_name: '',
      student_roll: '',
      student_dept: 'Computer Science & Engineering',
      incident_date: demoDate,
      incident_time: formatDemoTime(),
      material_confiscated: '',
      incident_details: '',
      student_statement: '',
      witness_name: '',
      evidence_photo_url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=600&q=80'
    });

    if (isFaculty) {
      setActiveTab('my_reports');
    } else {
      setActiveTab('manage_records');
    }
  };

  // Delete Incident Record (Admin Only)
  const handleDeleteIncident = async (id) => {
    if (!confirm('Are you sure you want to delete this case record?')) return;
    try {
      await api.deleteIncident(id);
    } catch (err) {
      console.warn('Backend delete note:', err.message);
    }
    setIncidents(prev => prev.filter(r => r.id !== id));
  };

  // Filtered List for Admin View
  const filteredIncidents = incidents.filter(r => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      r.report_number.toLowerCase().includes(q) ||
      r.student_name.toLowerCase().includes(q) ||
      r.student_roll.toLowerCase().includes(q) ||
      (r.student_dept && r.student_dept.toLowerCase().includes(q)) ||
      r.exam_name.toLowerCase().includes(q) ||
      r.room_number.toLowerCase().includes(q) ||
      r.invigilator_name.toLowerCase().includes(q)
    );
  });

  // Filtered List for Faculty (Their own submitted reports)
  const facultyMyReports = incidents.filter(r => {
    if (!user) return true;
    return r.invigilator_name.toLowerCase().includes(user.name.toLowerCase()) || 
           Number(r.invigilator_id) === Number(user.id);
  });

  // Unique affected rooms
  const uniqueRoomsCount = new Set(incidents.map(r => r.room_number)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Workflow Navigation Banner */}
      <div className="workflow-banner workflow-banner--navigation" style={{
        background: 'linear-gradient(90deg, rgba(244,63,94,0.12), rgba(99,102,241,0.12))',
        border: '1px solid rgba(244,63,94,0.25)',
        borderRadius: '10px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            background: '#f43f5e',
            color: '#fff',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 800
          }}>6</span>
          <div>
            <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Step 6: Exam Cheating & UFM Incident Management</strong>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>
              Real-time incident reporting from exam halls. Integrates with camera evidence capture, student statement recording, and penalty tracking.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {onNavigateToStep && (
            <button 
              className="btn btn-secondary" 
              onClick={() => onNavigateToStep('attendance')}
              style={{ fontSize: '0.82rem' }}
            >
              <span>⬅️ Back to Step 5: Live Attendance</span>
            </button>
          )}

          {onNavigateToStep && (
            <button 
              className="btn btn-secondary" 
              onClick={() => onNavigateToStep('master-data')}
              style={{ fontSize: '0.82rem' }}
            >
              <span>Step 1: Master Data</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin KPI Overview Cards - Clean & Simple */}
      {isAdmin && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={15} color="#38bdf8" /> Total Cases Submitted
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f3f4f6', marginTop: '0.25rem' }}>
              {incidents.length} Cases
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Reported across all classrooms</span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={15} color="#f87171" /> Exam Rooms Affected
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171', marginTop: '0.25rem' }}>
              {uniqueRoomsCount} Rooms
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Rooms where students were caught</span>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Camera size={15} color="#34d399" /> Cases With Photo Proof
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>
              {incidents.filter(r => r.evidence_photo_url).length} Photos
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Photographic evidence attached</span>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs (Faculty Only: Submit Case Report & My Cases) */}
      {isFaculty && (
        <div className="nav-tabs" style={{ marginBottom: '0.25rem' }}>
          <button
            className={`tab-btn ${activeTab === 'submit_report' ? 'active' : ''}`}
            onClick={() => setActiveTab('submit_report')}
          >
            <Plus size={16} />
            <span>Submit Cheating Report</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'my_reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_reports')}
          >
            <UserCheck size={16} />
            <span>My Submitted Cases ({facultyMyReports.length})</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: MANAGE INCIDENT RECORDS (ADMIN VIEW) - RECORDS & DETAILS ONLY     */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="panel-card">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="panel-title">
              <h2>Submitted Cheating Cases & Records</h2>
              <p>Official examination incident records reported by invigilators with student details and photo proof.</p>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={loadIncidents} 
              disabled={loading}
              title="Refresh records"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Simple Search Input */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem'
          }}>
            <div className="search-box" style={{ width: '100%', maxWidth: '480px' }}>
              <Search size={16} color="#6b7280" />
              <input
                type="text"
                placeholder="Search by student name, roll number, class, exam, or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searchQuery && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            )}
          </div>

          {/* Simple Incident Records Table - Exact User Request */}
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Case No. & Date</th>
                  <th>Student & Roll No.</th>
                  <th>Class / Department</th>
                  <th>Exam & Room</th>
                  <th>What Was Found</th>
                  <th>Reported By</th>
                  <th>Photo Proof</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={30} style={{ margin: '0 auto 0.5rem', color: '#10b981', opacity: 0.8 }} />
                      <div style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '1rem', marginBottom: '0.25rem' }}>
                        No Cases Found
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        No cheating cases match your search query.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((report) => (
                    <tr key={report.id}>
                      {/* 1. Case No & Date */}
                      <td>
                        <span style={{ fontWeight: 800, color: '#6366f1', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {report.report_number}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.15rem' }}>
                          {report.incident_date}
                        </span>
                      </td>

                      {/* 2. Student & Roll No */}
                      <td>
                        <span style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '0.9rem' }}>
                          {report.student_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'block', fontFamily: 'monospace' }}>
                          Roll No: {report.student_roll}
                        </span>
                      </td>

                      {/* 3. Class / Department */}
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#e5e7eb', fontWeight: 600 }}>
                          {report.student_dept || 'General'}
                        </span>
                      </td>

                      {/* 4. Exam & Room */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.82rem' }}>
                            {report.exam_name}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            Room {report.room_number} {report.desk_number ? `(${report.desk_number})` : ''}
                          </span>
                        </div>
                      </td>

                      {/* 5. What Was Found */}
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 600, display: 'block', maxWidth: '220px' }}>
                          {report.material_confiscated || 'Unauthorized material'}
                        </span>
                      </td>

                      {/* 6. Reported By */}
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#e5e7eb', fontWeight: 600 }}>
                          {report.invigilator_name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block' }}>
                          {report.invigilator_department || 'Teacher'}
                        </span>
                      </td>

                      {/* 7. Photo Proof */}
                      <td>
                        {report.evidence_photo_url ? (
                          <div 
                            onClick={() => setPhotoModal({
                              isOpen: true,
                              photoUrl: report.evidence_photo_url,
                              title: `${report.student_name} (${report.student_roll}) - Room ${report.room_number}`
                            })}
                            style={{
                              width: '52px',
                              height: '40px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: '1px solid rgba(255,255,255,0.2)',
                              position: 'relative'
                            }}
                            title="Click to view full photo proof"
                          >
                            <img 
                              src={report.evidence_photo_url} 
                              alt="Proof" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Eye size={13} color="#fff" />
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>No Photo</span>
                        )}
                      </td>

                      {/* 8. Status */}
                      <td>
                        <span 
                          className="badge" 
                          style={{ 
                            background: 'rgba(56, 189, 248, 0.15)', 
                            color: '#38bdf8', 
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}
                        >
                          Case Submitted
                        </span>
                      </td>

                      {/* 9. Action */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem', color: '#818cf8', borderColor: '#818cf8' }}
                            onClick={() => setSelectedCase(report)}
                            title="View full case details"
                          >
                            <Eye size={13} />
                            <span>View Details</span>
                          </button>

                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.35rem 0.55rem', fontSize: '0.76rem' }}
                            onClick={() => handleDeleteIncident(report.id)}
                            title="Delete case"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SUBMIT CHEATING REPORT (FACULTY ONLY)                             */}
      {/* ========================================================================= */}
      {isFaculty && activeTab === 'submit_report' && (
        <div className="panel-card" style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
          <div className="panel-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div className="panel-title">
              <h2>Submit Cheating Case Report</h2>
              <p>Fill in this simple form if a student was caught with cheating materials during the exam.</p>
            </div>
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              New Case Entry
            </div>
          </div>

          <form onSubmit={handleSubmitReport}>
            
            {/* Section 1: Exam & Room */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.92rem', color: '#38bdf8', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BookOpen size={16} />
                <span>1. Exam & Classroom Location</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Exam / Subject *</label>
                  <select
                    className="form-control"
                    value={form.exam_id}
                    onChange={(e) => {
                      const selected = exams.find(x => String(x.id) === String(e.target.value));
                      setForm(prev => ({
                        ...prev,
                        exam_id: e.target.value,
                        exam_name: selected ? `${selected.exam_name} (${selected.course_code})` : prev.exam_name,
                        course_code: selected ? selected.course_code : prev.course_code,
                        incident_date: selected ? selected.exam_date : prev.incident_date
                      }));
                    }}
                    required
                  >
                    <option value="">Select Scheduled Exam...</option>
                    {exams.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.course_code} - {ex.exam_name} ({ex.exam_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Room / Classroom *</label>
                  <select
                    className="form-control"
                    value={form.room_id}
                    onChange={(e) => {
                      const selected = rooms.find(r => String(r.id) === String(e.target.value));
                      setForm(prev => ({
                        ...prev,
                        room_id: e.target.value,
                        room_number: selected ? selected.room_number : prev.room_number
                      }));
                    }}
                    required
                  >
                    <option value="">Select Exam Venue Room...</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.building || 'Hall'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Desk / Seat Position</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Row 3, Desk 14"
                    value={form.desk_number}
                    onChange={(e) => setForm({ ...form, desk_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Time Caught</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 10:45 AM"
                    value={form.incident_time}
                    onChange={(e) => setForm({ ...form, incident_time: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Student Details */}
            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.92rem', color: '#38bdf8', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserCheck size={16} />
                <span>2. Student Details</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Student Roll Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 21BCSE1042"
                    value={form.student_roll}
                    onChange={(e) => setForm({ ...form, student_roll: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Student Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Aman Sharma"
                    value={form.student_name}
                    onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Class / Department</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Computer Science & Engineering"
                    value={form.student_dept}
                    onChange={(e) => setForm({ ...form, student_dept: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: What Was Found */}
            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.92rem', color: '#f87171', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={16} />
                <span>3. What Was Found?</span>
              </h4>

              <div className="form-group">
                <label>Item Description / What Was Caught *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 3 handwritten formula chits under exam sheet, or mobile phone in pocket"
                  value={form.material_confiscated}
                  onChange={(e) => setForm({ ...form, material_confiscated: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Teacher's Observation (Briefly describe what you saw) *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Student was looking down under his desk repeatedly. Upon checking, chits were found underneath his exam clipboard."
                  value={form.incident_details}
                  onChange={(e) => setForm({ ...form, incident_details: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Student's Statement (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Student stated: 'I forgot the revision chits were in my clipboard'"
                  value={form.student_statement}
                  onChange={(e) => setForm({ ...form, student_statement: e.target.value })}
                />
              </div>
            </div>

            {/* Section 4: Photo Proof */}
            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.92rem', color: '#10b981', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Camera size={16} />
                <span>4. Photo Proof</span>
              </h4>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {/* 1. Real-Time Camera Viewfinder */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCameraModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2563eb', borderColor: '#3b82f6', fontWeight: 700 }}
                >
                  <Camera size={16} />
                  <span>Open Real-Time Camera (Live Click)</span>
                </button>

                {/* 2. Direct Mobile Native Camera */}
                <label 
                  className="btn btn-secondary" 
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Opens camera directly on phones and tablets"
                >
                  <Smartphone size={15} color="#38bdf8" />
                  <span>Phone Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>

                {/* 3. Upload File */}
                <label 
                  className="btn btn-secondary" 
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Upload size={14} />
                  <span>Upload Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>

                {/* 4. Sample Presets for Fast Testing */}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    evidence_photo_url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=600&q=80',
                    material_confiscated: prev.material_confiscated || '3 handwritten formula chits under exam sheet'
                  }))}
                >
                  Preset: Notes/Chits
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    evidence_photo_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
                    material_confiscated: prev.material_confiscated || 'Mobile phone with open discussion forum'
                  }))}
                >
                  Preset: Phone
                </button>
              </div>

              {/* Photo Preview */}
              {form.evidence_photo_url && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  maxWidth: '440px'
                }}>
                  <img
                    src={form.evidence_photo_url}
                    alt="Preview"
                    style={{
                      width: '90px',
                      height: '65px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#34d399', fontSize: '0.82rem', fontWeight: 700 }}>
                      <CheckCircle2 size={15} />
                      <span>Photo Attached</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, evidence_photo_url: '' }))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        marginTop: '0.25rem',
                        padding: 0
                      }}
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '1.25rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Reporting Teacher: <strong>{user ? user.name : 'Dr. Shilpa Mahajan'}</strong>
              </span>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem' }}
              >
                <CheckCircle2 size={16} />
                <span>Submit Case Report</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: MY SUBMITTED REPORTS (FACULTY ONLY)                                */}
      {/* ========================================================================= */}
      {isFaculty && activeTab === 'my_reports' && (
        <div className="panel-card">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className="panel-title">
              <h2>My Submitted Cheating Cases</h2>
              <p>Cases you have reported during your exam invigilation duties.</p>
            </div>

            <button 
              className="btn btn-primary"
              onClick={() => setActiveTab('submit_report')}
            >
              <Plus size={15} />
              <span>Submit New Case</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Case No. & Date</th>
                  <th>Student & Roll No.</th>
                  <th>Class / Department</th>
                  <th>Exam & Room</th>
                  <th>What Was Found</th>
                  <th>Photo Proof</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {facultyMyReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={30} style={{ margin: '0 auto 0.5rem', color: '#10b981', opacity: 0.8 }} />
                      <div style={{ fontWeight: 700, color: '#f3f4f6', fontSize: '1rem', marginBottom: '0.35rem' }}>
                        No Cases Reported Yet
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        You have not reported any cheating cases yet.
                      </p>
                      <button className="btn btn-primary" onClick={() => setActiveTab('submit_report')}>
                        <Plus size={14} />
                        <span>Submit a Case</span>
                      </button>
                    </td>
                  </tr>
                ) : (
                  facultyMyReports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <span style={{ fontWeight: 800, color: '#6366f1', fontFamily: 'monospace' }}>
                          {report.report_number}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.15rem' }}>
                          {report.incident_date}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#f3f4f6' }}>{report.student_name}</span>
                        <span style={{ fontSize: '0.74rem', color: '#38bdf8', display: 'block', fontFamily: 'monospace' }}>
                          Roll No: {report.student_roll}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#e5e7eb', fontWeight: 600 }}>
                          {report.student_dept || 'General'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.82rem' }}>{report.exam_name}</span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>
                          Room {report.room_number}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 600 }}>
                          {report.material_confiscated}
                        </span>
                      </td>
                      <td>
                        {report.evidence_photo_url ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem' }}
                            onClick={() => setPhotoModal({
                              isOpen: true,
                              photoUrl: report.evidence_photo_url,
                              title: `${report.student_name} (${report.student_roll})`
                            })}
                          >
                            <Eye size={12} />
                            <span>View Photo</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <span 
                          className="badge" 
                          style={{ 
                            background: 'rgba(56, 189, 248, 0.15)', 
                            color: '#38bdf8', 
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            fontSize: '0.72rem',
                            fontWeight: 700
                          }}
                        >
                          Case Submitted
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.76rem' }}
                          onClick={() => setSelectedCase(report)}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW CASE DETAILS (SIMPLE & UNDERSTANDABLE)                      */}
      {/* ========================================================================= */}
      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '620px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                  Case Details: {selectedCase.report_number}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                  Reported on {selectedCase.incident_date} at {selectedCase.incident_time}
                </span>
              </div>
              <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              
              {/* Student & Class Box */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.84rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>Student Name</span>
                  <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{selectedCase.student_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>Roll Number</span>
                  <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedCase.student_roll}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>Class / Department</span>
                  <strong style={{ color: '#e5e7eb' }}>{selectedCase.student_dept}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>Reported By Teacher</span>
                  <strong style={{ color: '#e5e7eb' }}>{selectedCase.invigilator_name}</strong>
                </div>
              </div>

              {/* Exam & Room Box */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr',
                gap: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.84rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>Exam / Subject</span>
                  <strong style={{ color: '#fff' }}>{selectedCase.exam_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>Classroom & Desk</span>
                  <strong style={{ color: '#fff' }}>Room {selectedCase.room_number} ({selectedCase.desk_number || 'Desk N/A'})</strong>
                </div>
              </div>

              {/* What Was Found */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                padding: '0.85rem',
                borderRadius: '8px'
              }}>
                <span style={{ fontSize: '0.74rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>
                  What Was Found / Confiscated:
                </span>
                <p style={{ color: '#fca5a5', margin: '0.25rem 0 0', fontWeight: 600, fontSize: '0.88rem' }}>
                  {selectedCase.material_confiscated}
                </p>
              </div>

              {/* Teacher's Note */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '0.85rem',
                borderRadius: '8px'
              }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Teacher's Note / What Happened:
                </span>
                <p style={{ color: '#e5e7eb', margin: '0.25rem 0 0', fontSize: '0.84rem', lineHeight: '1.4' }}>
                  "{selectedCase.incident_details}"
                </p>
              </div>

              {/* Student's Statement */}
              {selectedCase.student_statement && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '0.85rem',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                    Student's Statement:
                  </span>
                  <p style={{ color: '#cbd5e1', margin: '0.25rem 0 0', fontSize: '0.84rem', fontStyle: 'italic' }}>
                    "{selectedCase.student_statement}"
                  </p>
                </div>
              )}

              {/* Photo Proof */}
              {selectedCase.evidence_photo_url && (
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                    Photo Proof Attached:
                  </span>
                  <div 
                    onClick={() => setPhotoModal({
                      isOpen: true,
                      photoUrl: selectedCase.evidence_photo_url,
                      title: `${selectedCase.student_name} (${selectedCase.student_roll})`
                    })}
                    style={{
                      maxWidth: '220px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer'
                    }}
                  >
                    <img 
                      src={selectedCase.evidence_photo_url} 
                      alt="Proof" 
                      style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} 
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsPrintModalOpen(true);
                }}
              >
                <Printer size={14} />
                <span>Print Case Report</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedCase(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PRINTABLE SIMPLE CASE REPORT                                     */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedCase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', background: '#ffffff', color: '#111827', padding: '2rem' }}>
            
            <div style={{ textAlign: 'center', borderBottom: '2px solid #111827', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: '#111827', margin: 0 }}>
                Exam Incident Report
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.25rem' }}>
                Case No: <strong>{selectedCase.report_number}</strong> | Date: {selectedCase.incident_date}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div><strong>Student Name:</strong> {selectedCase.student_name}</div>
              <div><strong>Roll Number:</strong> {selectedCase.student_roll}</div>
              <div><strong>Class / Department:</strong> {selectedCase.student_dept}</div>
              <div><strong>Exam Subject:</strong> {selectedCase.exam_name}</div>
              <div><strong>Classroom:</strong> Room {selectedCase.room_number} ({selectedCase.desk_number})</div>
              <div><strong>Reported By:</strong> {selectedCase.invigilator_name}</div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.2rem' }}>What Was Found:</div>
              <p style={{ background: '#fef2f2', padding: '0.5rem', borderRadius: '4px', border: '1px solid #fecaca', margin: 0 }}>
                {selectedCase.material_confiscated}
              </p>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Teacher's Note:</div>
              <p style={{ background: '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', margin: 0 }}>
                "{selectedCase.incident_details}"
              </p>
            </div>

            {selectedCase.student_statement && (
              <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Student's Statement:</div>
                <p style={{ background: '#f9fafb', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', margin: 0 }}>
                  "{selectedCase.student_statement}"
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed #9ca3af', fontSize: '0.82rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '30px' }}></div>
                <strong>{selectedCase.invigilator_name}</strong>
                <div>Teacher's Signature</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '30px' }}></div>
                <strong>Exam Cell Authority</strong>
                <div>Authorized Signatory</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#374151', borderColor: '#d1d5db' }}
                onClick={() => setIsPrintModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Report</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FULL PHOTO PROOF PREVIEW                                         */}
      {/* ========================================================================= */}
      {photoModal.isOpen && (
        <div className="modal-overlay" onClick={() => setPhotoModal({ isOpen: false, photoUrl: '', title: '' })}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '600px', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{photoModal.title || 'Photo Proof'}</h3>
              </div>
              <button className="close-btn" onClick={() => setPhotoModal({ isOpen: false, photoUrl: '', title: '' })}>✕</button>
            </div>

            <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)', background: '#000', textAlign: 'center' }}>
              <img
                src={photoModal.photoUrl}
                alt="Evidence"
                style={{ maxWidth: '100%', maxHeight: '440px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem' }}
                onClick={() => setPhotoModal({ isOpen: false, photoUrl: '', title: '' })}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REAL-TIME DEVICE CAMERA VIEWFINDER MODAL                         */}
      {/* ========================================================================= */}
      {isCameraModalOpen && (
        <div className="modal-overlay" onClick={closeCameraModal}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '640px', background: '#0b1120', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Camera size={18} color="#38bdf8" /> Real-Time Device Camera
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Point camera at cheating material / admit card and click Capture Photo
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={closeCameraModal}>✕</button>
            </div>

            {/* Camera Device Selector if multiple available */}
            {availableDevices.length > 1 && !tempCapturedPhoto && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '0.85rem',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Camera Device:</span>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.8rem',
                    width: '100%',
                    cursor: 'pointer'
                  }}
                >
                  {availableDevices.map((dev, idx) => (
                    <option key={dev.deviceId || idx} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cameraError ? (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <strong>Camera Notice:</strong> {cameraError}
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => startStream(selectedDeviceId || null)} style={{ fontSize: '0.78rem' }}>
                    <RotateCcw size={13} /> Try Again
                  </button>
                  <label className="btn btn-secondary" style={{ fontSize: '0.78rem', cursor: 'pointer' }}>
                    <Upload size={13} /> Upload Photo Instead
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handleFileUpload(e); closeCameraModal(); }} />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => {
                      setForm(prev => ({
                        ...prev,
                        evidence_photo_url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=600&q=80',
                        material_confiscated: prev.material_confiscated || 'Handwritten chits confiscated during exam'
                      }));
                      closeCameraModal();
                    }}
                  >
                    Use Sample Photo Proof
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', background: '#0a0f1d', borderRadius: '12px', overflow: 'hidden', minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                
                {/* Live Video Feed */}
                {!tempCapturedPhoto ? (
                  <>
                    <video
                      ref={(el) => {
                        videoRef.current = el;
                        if (el && streamRef.current && el.srcObject !== streamRef.current) {
                          el.srcObject = streamRef.current;
                          el.muted = true;
                          el.defaultMuted = true;
                          el.playsInline = true;
                          el.setAttribute('playsinline', '');
                          el.setAttribute('muted', '');
                          el.play().then(() => setStreamActive(true)).catch(e => console.log('Autoplay:', e));
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={(e) => {
                        e.target.muted = true;
                        e.target.play().then(() => setStreamActive(true)).catch(e => console.log('Metadata play:', e));
                      }}
                      style={{
                        width: '100%',
                        height: '340px',
                        objectFit: 'contain',
                        background: '#0a0f1d',
                        display: 'block'
                      }}
                    />

                    {/* Viewfinder Target Brackets */}
                    <div style={{ position: 'absolute', top: '16px', left: '16px', width: '32px', height: '32px', borderTop: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8', pointerEvents: 'none', zIndex: 2 }} />
                    <div style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderTop: '3px solid #38bdf8', borderRight: '3px solid #38bdf8', pointerEvents: 'none', zIndex: 2 }} />
                    <div style={{ position: 'absolute', bottom: '16px', left: '16px', width: '32px', height: '32px', borderBottom: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8', pointerEvents: 'none', zIndex: 2 }} />
                    <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '32px', height: '32px', borderBottom: '3px solid #38bdf8', borderRight: '3px solid #38bdf8', pointerEvents: 'none', zIndex: 2 }} />

                    {/* Live Badge Overlay */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0, 0, 0, 0.8)',
                      border: streamActive ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(245, 158, 11, 0.6)',
                      color: streamActive ? '#34d399' : '#fbbf24',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      zIndex: 3
                    }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: streamActive ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
                      {streamActive ? 'LIVE CAMERA FEED' : 'CONNECTING CAMERA...'}
                    </div>
                  </>
                ) : (
                  /* Review Captured Snapshot */
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <img
                      src={tempCapturedPhoto}
                      alt="Captured Snapshot"
                      style={{ width: '100%', height: '340px', objectFit: 'contain', display: 'block', background: '#0a0f1d' }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: '#fff',
                      padding: '0.3rem 0.85rem',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      zIndex: 3
                    }}>
                      <CheckCircle2 size={14} /> Photo Captured - Ready to Attach
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Laptop Troubleshooting & Hardware Un-Mute Card */}
            {!tempCapturedPhoto && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.7rem 0.9rem',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: '#cbd5e1'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Camera size={14} /> Source: {activeCameraLabel}
                  </span>
                  <span style={{ color: streamActive ? '#34d399' : '#fbbf24', fontSize: '0.72rem', fontWeight: 600 }}>
                    Status: {streamActive ? 'Active Stream' : 'Connecting...'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.45 }}>
                  <div style={{ color: '#e2e8f0', marginTop: '0.15rem' }}>
                    • <strong>Opera GX Permission:</strong> In your address bar next to <code>localhost:5173</code>, click the <strong>Settings icon</strong> and make sure Camera is set to <strong>Allow</strong>.
                  </div>
                  <div style={{ color: '#e2e8f0', marginTop: '0.15rem' }}>
                    • <strong>Keyboard Sensor Hotkey:</strong> Press <strong>Fn + F10</strong> (or <strong>Fn + F6</strong>) if camera screen is dark to enable the sensor.
                  </div>
                  <div style={{ color: '#e2e8f0', marginTop: '0.15rem' }}>
                    • <strong>Quick Test / Upload:</strong> Click <strong>Live Test Camera</strong> or <strong>Upload Photo</strong> below to capture photo proof immediately.
                  </div>
                </div>
              </div>
            )}

            {/* Controls Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '1rem',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              {!tempCapturedPhoto ? (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startStream(selectedDeviceId || null)}
                      style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      title="Retry physical camera"
                    >
                      <RotateCcw size={13} />
                      <span>Retry Cam</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={startSimulatorStream}
                      style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                      title="Activate live camera feed simulator"
                    >
                      <Camera size={13} />
                      <span>Live Test Camera</span>
                    </button>

                    <label className="btn btn-secondary" style={{ fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Upload size={13} />
                      <span>Upload Photo</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handleFileUpload(e); closeCameraModal(); }} />
                    </label>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.78rem' }}
                      title="Attach sample photo proof"
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          evidence_photo_url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=600&q=80',
                          material_confiscated: prev.material_confiscated || 'Handwritten chits confiscated during exam'
                        }));
                        closeCameraModal();
                      }}
                    >
                      Sample Photo
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={takeSnapshot}
                      style={{
                        padding: '0.65rem 1.6rem',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
                        borderColor: '#38bdf8',
                        borderRadius: '30px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)'
                      }}
                    >
                      <Camera size={18} />
                      <span>Capture Photo</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeCameraModal}
                      style={{ fontSize: '0.8rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={retakeSnapshot}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <RotateCcw size={14} />
                    <span>Retake Photo</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={acceptCapturedPhoto}
                    style={{
                      background: '#10b981',
                      borderColor: '#10b981',
                      padding: '0.6rem 1.4rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>Use This Photo</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
