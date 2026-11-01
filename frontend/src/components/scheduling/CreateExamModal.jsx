import React, { useState, useEffect } from 'react';
import { useDemoTime } from '../../context/DemoTimeContext';
import { 
  X, Calendar, Clock, AlertTriangle, CheckCircle2, 
  BookOpen, Sparkles, AlertCircle, Info, ShieldAlert,
  ArrowRight, Check, Zap
} from 'lucide-react';
import { api } from '../../api';

// Time manipulation helpers
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.toString().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

const minutesToTime = (totalM) => {
  let m = Math.max(0, Math.min(1439, totalM));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
};

const ensureTimeWithSeconds = (t) => {
  if (!t) return '09:30:00';
  const parts = t.toString().split(':');
  const h = (parts[0] || '09').padStart(2, '0');
  const m = (parts[1] || '30').padStart(2, '0');
  const s = (parts[2] || '00').padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatDurationLabel = (mins) => {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m (${mins} min)`;
  if (h > 0) return `${h} hr${h > 1 ? 's' : ''} (${mins} min)`;
  return `${m} min`;
};

export default function CreateExamModal({ isOpen, onClose, onSuccess, initialExam = null, courses = [], onOpenGenerateTimetable = null, timetableSpan = null }) {
  const { demoDate, demoTime } = useDemoTime();
  const isEdit = Boolean(initialExam && initialExam.id);

  const [formData, setFormData] = useState({
    course_id: '',
    exam_name: '',
    exam_type: 'END_TERM',
    exam_date: '',
    start_time: '09:30:00',
    end_time: '12:30:00',
    duration_minutes: 180,
    status: 'SCHEDULED'
  });

  const [scheduleMode, setScheduleMode] = useState('CUSTOM'); // 'CUSTOM' | 'AI'
  const [aiStartDate, setAiStartDate] = useState(timetableSpan?.startDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }));
  const [aiEndDate, setAiEndDate] = useState(timetableSpan?.endDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 16);
    return d.toISOString().split('T')[0];
  }));
  const [aiPreferredSlot, setAiPreferredSlot] = useState('ANY');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiOptimalResult, setAiOptimalResult] = useState(null);
  const [aiSearchError, setAiSearchError] = useState(null);

  const [selectedSlotPreset, setSelectedSlotPreset] = useState('MORNING');
  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize form when opened or exam changes
  useEffect(() => {
    if (timetableSpan?.startDate) setAiStartDate(timetableSpan.startDate);
    if (timetableSpan?.endDate) setAiEndDate(timetableSpan.endDate);

    if (initialExam) {
      const start = initialExam.start_time || '09:30:00';
      const end = initialExam.end_time || '12:30:00';
      const startM = timeToMinutes(start);
      const endM = timeToMinutes(end);
      const diff = endM > startM ? endM - startM : (initialExam.duration_minutes || 180);

      setFormData({
        course_id: initialExam.course_id || '',
        exam_name: initialExam.exam_name || '',
        exam_type: initialExam.exam_type || 'END_TERM',
        exam_date: initialExam.exam_date || '',
        start_time: start,
        end_time: end,
        duration_minutes: diff,
        status: initialExam.status || 'SCHEDULED'
      });

      // Determine preset
      if (start.slice(0, 5) === '09:30' && end.slice(0, 5) === '12:30' && diff === 180) {
        setSelectedSlotPreset('MORNING');
      } else if (start.slice(0, 5) === '14:00' && end.slice(0, 5) === '17:00' && diff === 180) {
        setSelectedSlotPreset('AFTERNOON');
      } else {
        setSelectedSlotPreset('CUSTOM');
      }
    } else {
      // Default to start date of session or active demo date
      let defaultDate = timetableSpan?.startDate || demoDate;
      if (!defaultDate) {
        defaultDate = '2026-11-06';
      }

      const firstCourse = courses[0];
      setFormData({
        course_id: firstCourse ? firstCourse.id : '',
        exam_name: firstCourse ? `${firstCourse.course_code} Final Examination` : '',
        exam_type: 'END_TERM',
        exam_date: defaultDate,
        start_time: '09:30:00',
        end_time: '12:30:00',
        duration_minutes: 180,
        status: 'SCHEDULED'
      });
      setSelectedSlotPreset('MORNING');
    }
    setError(null);
    setValidationResult(null);
    setAiOptimalResult(null);
    setAiSearchError(null);
  }, [initialExam, isOpen, courses, timetableSpan]);

  // When course changes, auto-suggest exam name
  const handleCourseChange = (courseId) => {
    const course = courses.find(c => String(c.id) === String(courseId));
    let name = formData.exam_name;
    if (course) {
      const typeLabel = formData.exam_type === 'END_TERM' ? 'Final Examination' : formData.exam_type === 'MID_TERM' ? 'Mid-Term Exam' : 'Quiz';
      name = `${course.course_code} - ${course.course_name} ${typeLabel}`;
    }
    setFormData(prev => ({
      ...prev,
      course_id: courseId,
      exam_name: name
    }));
  };

  // Slot preset selector
  const handleSlotPresetChange = (preset) => {
    setSelectedSlotPreset(preset);
    if (preset === 'MORNING') {
      setFormData(prev => ({
        ...prev,
        start_time: '09:30:00',
        end_time: '12:30:00',
        duration_minutes: 180
      }));
    } else if (preset === 'AFTERNOON') {
      setFormData(prev => ({
        ...prev,
        start_time: '14:00:00',
        end_time: '17:00:00',
        duration_minutes: 180
      }));
    } else if (preset === 'EVENING') {
      setFormData(prev => ({
        ...prev,
        start_time: '17:30:00',
        end_time: '20:30:00',
        duration_minutes: 180
      }));
    } else if (preset === 'CUSTOM') {
      setFormData(prev => {
        const startM = timeToMinutes(prev.start_time);
        const endM = timeToMinutes(prev.end_time);
        let dur = prev.duration_minutes || 120;
        let newEnd = prev.end_time;
        if (endM > startM) {
          dur = endM - startM;
        } else {
          newEnd = minutesToTime(startM + dur);
        }
        return {
          ...prev,
          end_time: newEnd,
          duration_minutes: dur
        };
      });
    }
  };

  // Bidirectional handlers for time & duration synchronization
  const handleStartTimeChange = (val) => {
    if (!val) return;
    const fullTime = ensureTimeWithSeconds(val);
    setSelectedSlotPreset('CUSTOM');
    setFormData(prev => {
      const newStartM = timeToMinutes(fullTime);
      const currentEndM = timeToMinutes(prev.end_time);
      let newDur = prev.duration_minutes || 120;
      let newEnd = prev.end_time;

      if (currentEndM > newStartM) {
        newDur = currentEndM - newStartM;
      } else {
        newEnd = minutesToTime(newStartM + newDur);
      }

      return {
        ...prev,
        start_time: fullTime,
        end_time: newEnd,
        duration_minutes: newDur
      };
    });
  };

  const handleEndTimeChange = (val) => {
    if (!val) return;
    const fullTime = ensureTimeWithSeconds(val);
    setSelectedSlotPreset('CUSTOM');
    setFormData(prev => {
      const startM = timeToMinutes(prev.start_time);
      const newEndM = timeToMinutes(fullTime);
      let newDur = prev.duration_minutes || 120;

      if (newEndM > startM) {
        newDur = newEndM - startM;
      }

      return {
        ...prev,
        end_time: fullTime,
        duration_minutes: newDur
      };
    });
  };

  const handleDurationChange = (val) => {
    const mins = Math.max(15, Math.min(480, Number(val) || 0));
    setSelectedSlotPreset('CUSTOM');
    setFormData(prev => {
      const startM = timeToMinutes(prev.start_time);
      const newEnd = minutesToTime(startM + mins);
      return {
        ...prev,
        duration_minutes: mins,
        end_time: newEnd
      };
    });
  };

  // AI Optimal Slot Finder across user-selected dates span
  const handleAIFindSlot = async () => {
    if (!formData.course_id) {
      setError('Please select an Academic Course first before running AI slot finder.');
      return;
    }
    setAiSearching(true);
    setAiSearchError(null);
    try {
      const res = await api.suggestOptimalSlot({
        course_id: Number(formData.course_id),
        startDate: aiStartDate,
        endDate: aiEndDate,
        preferredSlot: aiPreferredSlot,
        skipWeekends: true,
        excludeExamId: initialExam?.id || null
      });

      if (res && res.data && res.data.optimalSlot) {
        const slot = res.data.optimalSlot;
        setAiOptimalResult(res.data);
        setFormData(prev => ({
          ...prev,
          exam_date: slot.exam_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_minutes: slot.duration_minutes || 180
        }));
        if (slot.slot_key) {
          setSelectedSlotPreset(slot.slot_key);
        }
      } else {
        throw new Error(res.message || 'No suitable slot found in the specified dates span.');
      }
    } catch (err) {
      setAiSearchError(err.message || 'Failed to find optimal slot.');
    } finally {
      setAiSearching(false);
    }
  };

  // Live Slot Conflict Validation
  useEffect(() => {
    if (!formData.course_id || !formData.exam_date || !formData.start_time || !formData.end_time) {
      setValidationResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await api.validateExamSlot({
          course_id: Number(formData.course_id),
          exam_date: formData.exam_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          excludeExamId: initialExam?.id || null
        });
        if (res && res.data) {
          setValidationResult(res.data);
        }
      } catch (err) {
        console.warn('Live conflict check error:', err.message);
      } finally {
        setValidating(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.course_id, formData.exam_date, formData.start_time, formData.end_time, initialExam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.course_id) {
      setError('Please select an academic course.');
      return;
    }
    if (!formData.exam_name.trim()) {
      setError('Exam name is required.');
      return;
    }
    if (!formData.exam_date) {
      setError('Exam date is required.');
      return;
    }
    
    const startM = timeToMinutes(formData.start_time);
    const endM = timeToMinutes(formData.end_time);
    if (startM >= endM) {
      setError('Start time must be strictly earlier than end time.');
      return;
    }

    const calculatedDuration = endM - startM;

    // Check if there are critical hard conflicts
    if (validationResult && validationResult.conflicts && validationResult.conflicts.length > 0) {
      setError(`Cannot schedule exam: ${validationResult.conflicts[0].message}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        start_time: ensureTimeWithSeconds(formData.start_time),
        end_time: ensureTimeWithSeconds(formData.end_time),
        duration_minutes: calculatedDuration,
        course_id: Number(formData.course_id)
      };

      if (isEdit) {
        await api.updateExam(initialExam.id, payload);
      } else {
        await api.createExam(payload);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save examination.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCourse = courses.find(c => String(c.id) === String(formData.course_id));

  return (
    <div className="modal-overlay">
      <div 
        className="modal-content"
        style={{
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto'
        }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(6, 182, 212, 0.3))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(99, 102, 241, 0.4)'
              }}
            >
              <Calendar size={20} color="#818cf8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {isEdit ? 'Edit Examination Schedule' : 'Schedule New Examination'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isEdit ? 'Modify examination parameters and re-verify conflicts' : 'Assign course to timetable with real-time clash verification'}
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {error && (
            <div 
              style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                color: '#fca5a5',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem'
              }}
            >
              <AlertCircle size={18} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {/* Course Selection */}
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>Academic Course *</span>
              {selectedCourse && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                  {selectedCourse.department} · Sem {selectedCourse.semester} · Difficulty {selectedCourse.difficulty_level}/5
                </span>
              )}
            </label>
            <select
              className="form-control"
              value={formData.course_id}
              onChange={(e) => handleCourseChange(e.target.value)}
              required
            >
              <option value="">-- Select Course --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.course_code} - {c.course_name} ({c.department} Sem-{c.semester}) [Diff: {c.difficulty_level || 3}]
                </option>
              ))}
            </select>
          </div>

          {/* Exam Name */}
          <div className="form-group">
            <label style={{ fontWeight: 700, fontSize: '0.86rem' }}>Examination Title *</label>
            <input
              type="text"
              className="form-control"
              value={formData.exam_name}
              onChange={(e) => setFormData(prev => ({ ...prev, exam_name: e.target.value }))}
              placeholder="e.g. CSE3005 Software Engineering End-Term"
              required
            />
          </div>

          {/* Exam Type & Status Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.86rem' }}>Exam Category</label>
              <select
                className="form-control"
                value={formData.exam_type}
                onChange={(e) => {
                  const newType = e.target.value;
                  setFormData(prev => ({ ...prev, exam_type: newType }));
                  if (selectedCourse) {
                    const typeLabel = newType === 'END_TERM' ? 'Final Examination' : newType === 'MID_TERM' ? 'Mid-Term Exam' : 'Quiz';
                    setFormData(prev => ({ ...prev, exam_name: `${selectedCourse.course_code} ${typeLabel}` }));
                  }
                }}
              >
                <option value="END_TERM">END_TERM (Final University Exam)</option>
                <option value="MID_TERM">MID_TERM (Mid-Semester Exam)</option>
                <option value="QUIZ">QUIZ (Continuous Assessment)</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.86rem' }}>Status</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="SCHEDULED">SCHEDULED (Active on Timetable)</option>
                <option value="DRAFT">DRAFT (Tentative / Under Review)</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          {/* Scheduling Mode Switcher */}
          <div 
            style={{
              display: 'flex',
              gap: '0.5rem',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '0.35rem',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <button
              type="button"
              className={`btn ${scheduleMode === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '0.84rem', padding: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}
              onClick={() => setScheduleMode('CUSTOM')}
            >
              <Calendar size={15} />
              <span>Customize Day & Time</span>
            </button>

            <button
              type="button"
              className={`btn ${scheduleMode === 'AI' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                flex: 1,
                fontSize: '0.84rem',
                padding: '0.55rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                background: scheduleMode === 'AI' ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : undefined,
                boxShadow: scheduleMode === 'AI' ? '0 0 16px rgba(99, 102, 241, 0.35)' : undefined
              }}
              onClick={() => setScheduleMode('AI')}
            >
              <Sparkles size={15} />
              <span>Find an available time</span>
            </button>
          </div>

          {/* AI Smart Slot Finder Panel */}
          {scheduleMode === 'AI' && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(6, 182, 212, 0.08))',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '12px',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Sparkles size={16} color="#818cf8" />
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f3f4f6' }}>
                      Suggested time slot
                    </span>
                  </div>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Choose a date range. ExamSphere will check available slots and avoid scheduling conflicts.
                  </p>
                </div>

                {onOpenGenerateTimetable && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.74rem', padding: '0.35rem 0.65rem', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      onClose();
                      onOpenGenerateTimetable();
                    }}
                    title="Generate entire timetable for all courses"
                  >
                    <span>Full Timetable Generator</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>

              {/* Dates Span Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem' }}>Span Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={aiStartDate}
                    onChange={(e) => {
                      setAiStartDate(e.target.value);
                      setAiOptimalResult(null);
                      setAiSearchError(null);
                      if (aiEndDate < e.target.value) {
                        const d = new Date(e.target.value);
                        d.setDate(d.getDate() + 14);
                        setAiEndDate(d.toISOString().split('T')[0]);
                      }
                    }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem' }}>Span End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={aiEndDate}
                    min={aiStartDate}
                    onChange={(e) => {
                      setAiEndDate(e.target.value);
                      setAiOptimalResult(null);
                      setAiSearchError(null);
                    }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.8rem' }}>Session Preference</label>
                  <select
                    className="form-control"
                    value={aiPreferredSlot}
                    onChange={(e) => {
                      setAiPreferredSlot(e.target.value);
                      setAiOptimalResult(null);
                    }}
                  >
                    <option value="ANY">Any Conflict-Free Slot</option>
                    <option value="MORNING">Morning Preferred</option>
                    <option value="AFTERNOON">Afternoon Preferred</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                    boxShadow: '0 0 16px rgba(99, 102, 241, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.84rem'
                  }}
                  disabled={aiSearching || !formData.course_id}
                  onClick={handleAIFindSlot}
                >
                  {aiSearching ? (
                    <>
                      <Clock size={15} className="spin" />
                      <span>Scanning Slots in Dates Span...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      <span>Find an available slot</span>
                    </>
                  )}
                </button>
              </div>

              {aiSearchError && (
                <div style={{ color: '#fca5a5', fontSize: '0.8rem', background: 'rgba(244, 63, 94, 0.15)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                  {aiSearchError}
                </div>
              )}

              {/* AI Optimal Found Result Display */}
              {aiOptimalResult && aiOptimalResult.optimalSlot && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#6ee7b7', fontWeight: 800, fontSize: '0.88rem' }}>
                      <CheckCircle2 size={18} color="#10b981" />
                      <span>Suggested slot:</span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                      {aiOptimalResult.optimalSlot.conflictsCount === 0 ? '✓ 0 Conflicts' : `${aiOptimalResult.optimalSlot.conflictsCount} Clash`}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f3f4f6' }}>
                    📅 {aiOptimalResult.optimalSlot.exam_date} · ⏰ {aiOptimalResult.optimalSlot.start_time} - {aiOptimalResult.optimalSlot.end_time} ({aiOptimalResult.optimalSlot.slot_name})
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#c7d2fe' }}>
                    {aiOptimalResult.optimalSlot.reason}
                  </div>

                  {aiOptimalResult.topAlternatives?.length > 0 && (
                    <div style={{ marginTop: '0.35rem', paddingTop: '0.45rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Other clean alternatives in this dates span:</span>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {aiOptimalResult.topAlternatives.map((alt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                            onClick={() => {
                              const diff = timeToMinutes(alt.end_time) - timeToMinutes(alt.start_time);
                              setFormData(prev => ({
                                ...prev,
                                exam_date: alt.exam_date,
                                start_time: alt.start_time,
                                end_time: alt.end_time,
                                duration_minutes: diff > 0 ? diff : 180
                              }));
                            }}
                          >
                            {alt.exam_date} ({alt.start_time.slice(0, 5)})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date & Slot Presets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.86rem' }}>Exam Date *</label>
              <input
                type="date"
                className="form-control"
                value={formData.exam_date}
                onChange={(e) => setFormData(prev => ({ ...prev, exam_date: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.86rem' }}>Time Slot Preset</label>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  className={`btn ${selectedSlotPreset === 'MORNING' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: '0.76rem', padding: '0.4rem 0.5rem' }}
                  onClick={() => handleSlotPresetChange('MORNING')}
                >
                  Morning (9:30-12:30)
                </button>
                <button
                  type="button"
                  className={`btn ${selectedSlotPreset === 'AFTERNOON' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: '0.76rem', padding: '0.4rem 0.5rem' }}
                  onClick={() => handleSlotPresetChange('AFTERNOON')}
                >
                  Afternoon (2-5)
                </button>
                <button
                  type="button"
                  className={`btn ${selectedSlotPreset === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.76rem', padding: '0.4rem 0.5rem' }}
                  onClick={() => handleSlotPresetChange('CUSTOM')}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>

          {/* Custom Start & End Times */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.82rem' }}>Start Time</label>
              <input
                type="time"
                step="60"
                className="form-control"
                value={formData.start_time ? formData.start_time.slice(0, 5) : '09:30'}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.82rem' }}>End Time</label>
              <input
                type="time"
                step="60"
                className="form-control"
                value={formData.end_time ? formData.end_time.slice(0, 5) : '12:30'}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 700, fontSize: '0.82rem', margin: 0 }}>Duration</label>
                <span style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                  {formatDurationLabel(formData.duration_minutes)}
                </span>
              </div>
              <input
                type="number"
                className="form-control"
                style={{ marginTop: '0.25rem' }}
                value={formData.duration_minutes || ''}
                onChange={(e) => handleDurationChange(e.target.value)}
                min="15"
                max="480"
                step="15"
              />
            </div>
          </div>

          {/* Quick Duration Presets for convenience */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '-0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Quick Duration:</span>
            {[
              { label: '1 hr (60m)', mins: 60 },
              { label: '1.5 hrs (90m)', mins: 90 },
              { label: '2 hrs (120m)', mins: 120 },
              { label: '3 hrs (180m)', mins: 180 }
            ].map(p => (
              <button
                key={p.mins}
                type="button"
                className={`btn ${formData.duration_minutes === p.mins ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  fontWeight: formData.duration_minutes === p.mins ? 700 : 500
                }}
                onClick={() => handleDurationChange(p.mins)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Live Conflict Pre-Check Banner */}
          <div 
            style={{
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              background: validationResult?.conflicts?.length > 0 
                ? 'rgba(244, 63, 94, 0.12)' 
                : validationResult?.warnings?.length > 0
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(16, 185, 129, 0.1)',
              border: `1px solid ${
                validationResult?.conflicts?.length > 0 
                  ? 'rgba(244, 63, 94, 0.35)' 
                  : validationResult?.warnings?.length > 0
                  ? 'rgba(245, 158, 11, 0.35)'
                  : 'rgba(16, 185, 129, 0.3)'
              }`,
              transition: 'var(--transition)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Real-Time Schedule Pre-Verification
              </span>
              {validating && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Analyzing cohort & student schedules...
                </span>
              )}
            </div>

            {validationResult?.conflicts?.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#fca5a5', fontSize: '0.83rem' }}>
                <ShieldAlert size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Conflict Detected: </strong>
                  {validationResult.conflicts[0].message}
                </div>
              </div>
            ) : validationResult?.warnings?.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#fde68a', fontSize: '0.83rem' }}>
                <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Pedagogical Warning: </strong>
                  {validationResult.warnings[0].message}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6ee7b7', fontSize: '0.83rem' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Slot is 100% Conflict-Free. Zero cohort collisions or student overlaps detected.</span>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (validationResult?.conflicts?.length > 0)}
              style={{
                opacity: (validationResult?.conflicts?.length > 0) ? 0.6 : 1,
                cursor: (validationResult?.conflicts?.length > 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? 'Saving Schedule...' : isEdit ? 'Update Schedule' : 'Schedule Examination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
