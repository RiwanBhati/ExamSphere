import React from 'react';
import { useDemoTime } from '../../context/DemoTimeContext';
import { 
  Calendar, Clock, Sun, Moon, Sunrise, BookOpen, 
  Users, AlertCircle, Edit, Trash2, CheckCircle2 
} from 'lucide-react';

const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  const parts = timeStr.toString().split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
};

const getSlotTimeDisplay = (examsInSlot, defaultRange, stdStart = '09:30', stdEnd = '12:30') => {
  if (!examsInSlot || examsInSlot.length === 0) {
    return { rangeText: defaultRange, isCustom: false };
  }

  // Check if all exams have identical timing
  const first = examsInSlot[0];
  const allSame = examsInSlot.every(
    e => e.start_time.slice(0, 5) === first.start_time.slice(0, 5) && 
         e.end_time.slice(0, 5) === first.end_time.slice(0, 5)
  );

  if (allSame) {
    const isCustom = first.start_time.slice(0, 5) !== stdStart || first.end_time.slice(0, 5) !== stdEnd;
    return {
      rangeText: `${formatTime12h(first.start_time)} - ${formatTime12h(first.end_time)}`,
      isCustom
    };
  }

  // Multiple exams with differing timings in this slot
  const sortedStarts = [...examsInSlot].map(e => e.start_time).sort();
  const sortedEnds = [...examsInSlot].map(e => e.end_time).sort();
  const minStart = sortedStarts[0];
  const maxEnd = sortedEnds[sortedEnds.length - 1];
  const isCustom = minStart.slice(0, 5) !== stdStart || maxEnd.slice(0, 5) !== stdEnd;

  return {
    rangeText: `${formatTime12h(minStart)} - ${formatTime12h(maxEnd)}`,
    isCustom
  };
};

export default function TimetableCalendarGrid({ matrix, onEditExam, onDeleteExam }) {
  const { demoDate, demoTime, isSlotActive } = useDemoTime();
  if (!matrix || !matrix.dates || matrix.dates.length === 0) {
    return (
      <div 
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}
      >
        <Calendar size={48} color="var(--primary)" style={{ margin: '0 auto 1rem', opacity: 0.7 }} />
        <h3 style={{ color: '#f3f4f6', marginBottom: '0.4rem', fontWeight: 700 }}>
          No Examinations Scheduled Yet
        </h3>
        <p style={{ fontSize: '0.86rem', maxWidth: '480px', margin: '0 auto' }}>
          Click "Generate Timetable" to run the automated difficulty-aware scheduling engine, or "Schedule Exam" to place an individual course.
        </p>
      </div>
    );
  }

  const { dates, grid } = matrix;

  const getDifficultyPill = (level) => {
    const diff = level || 3;
    let bg = 'rgba(16, 185, 129, 0.15)';
    let color = '#34d399';
    let border = 'rgba(16, 185, 129, 0.3)';
    let label = 'Diff 1-2 (Normal)';

    if (diff === 3) {
      bg = 'rgba(6, 182, 212, 0.15)';
      color = '#38bdf8';
      border = 'rgba(6, 182, 212, 0.3)';
      label = 'Diff 3 (Standard)';
    } else if (diff === 4) {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
      border = 'rgba(245, 158, 11, 0.3)';
      label = 'Diff 4 (Hard)';
    } else if (diff === 5) {
      bg = 'rgba(244, 63, 94, 0.15)';
      color = '#f87171';
      border = 'rgba(244, 63, 94, 0.35)';
      label = 'Diff 5 (Very Hard)';
    }

    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          padding: '0.15rem 0.45rem',
          borderRadius: '6px',
          background: bg,
          color,
          border: `1px solid ${border}`
        }}
      >
        {label}
      </span>
    );
  };

  const getDeptColor = (dept) => {
    switch (dept) {
      case 'CSE': return { bg: 'rgba(99, 102, 241, 0.15)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' };
      case 'ECE': return { bg: 'rgba(6, 182, 212, 0.15)', text: '#67e8f9', border: 'rgba(6, 182, 212, 0.3)' };
      case 'ME': return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fde68a', border: 'rgba(245, 158, 11, 0.3)' };
      default: return { bg: 'rgba(139, 92, 246, 0.15)', text: '#c4b5fd', border: 'rgba(139, 92, 246, 0.3)' };
    }
  };

  const renderExamCard = (exam) => {
    const deptStyle = getDeptColor(exam.department);

    return (
      <div
        key={exam.id}
        style={{
          background: 'rgba(17, 24, 39, 0.85)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          transition: 'var(--transition)',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: '5px',
                  background: deptStyle.bg,
                  color: deptStyle.text,
                  border: `1px solid ${deptStyle.border}`,
                  fontFamily: 'monospace'
                }}
              >
                {exam.course_code}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600
                }}
              >
                {exam.department} · Sem {exam.semester}
              </span>
            </div>
            <h5 
              style={{
                margin: 0,
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#f9fafb',
                lineHeight: 1.3
              }}
            >
              {exam.course_name || exam.exam_name}
            </h5>
          </div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {onEditExam && (
              <button
                type="button"
                className="btn-icon"
                title="Edit schedule"
                style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => onEditExam(exam)}
              >
                <Edit size={14} />
              </button>
            )}
            {onDeleteExam && (
              <button
                type="button"
                className="btn-icon"
                title="Delete exam"
                style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                onClick={() => onDeleteExam(exam.id)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <Clock size={13} color="var(--accent-cyan)" />
            <span style={{ fontWeight: 600, color: '#f3f4f6' }}>
              {exam.start_time.slice(0, 5)} - {exam.end_time.slice(0, 5)}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--accent-cyan)',
                background: 'rgba(6, 182, 212, 0.12)',
                padding: '0.05rem 0.4rem',
                borderRadius: '4px',
                fontWeight: 600
              }}
            >
              {(() => {
                const dur = exam.duration_minutes || (() => {
                  const s = exam.start_time.split(':').map(Number);
                  const e = exam.end_time.split(':').map(Number);
                  return (e[0] * 60 + (e[1] || 0)) - (s[0] * 60 + (s[1] || 0));
                })();
                const h = Math.floor(dur / 60);
                const m = dur % 60;
                if (h > 0 && m > 0) return `${h}h ${m}m`;
                if (h > 0) return `${h}h`;
                return `${m}m`;
              })()}
            </span>
          </div>

          <div>
            {getDifficultyPill(exam.difficulty_level)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {dates.map(dateStr => {
        const dayData = grid[dateStr] || { slots: { MORNING: [], AFTERNOON: [], EVENING: [] } };
        const totalDayExams = 
          dayData.slots.MORNING.length + 
          dayData.slots.AFTERNOON.length + 
          dayData.slots.EVENING.length;

        // Parse readable date format
        const dateParts = dateStr.split('-');
        const dt = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
        const formattedDateTitle = dt.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const isCurrentDemoDay = (dateStr === demoDate);

        return (
          <div
            key={dateStr}
            style={{
              background: isCurrentDemoDay ? 'rgba(6, 182, 212, 0.04)' : 'rgba(255, 255, 255, 0.02)',
              border: isCurrentDemoDay ? '1px solid rgba(6, 182, 212, 0.45)' : '1px solid var(--border-subtle)',
              boxShadow: isCurrentDemoDay ? '0 0 20px rgba(6, 182, 212, 0.12)' : 'none',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {/* Date Header */}
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Calendar size={18} color={isCurrentDemoDay ? '#38bdf8' : 'var(--primary)'} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: isCurrentDemoDay ? '#38bdf8' : '#f3f4f6' }}>
                  {formattedDateTitle}
                </h4>
                {isCurrentDemoDay && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '6px',
                      background: 'rgba(6, 182, 212, 0.2)',
                      color: '#38bdf8',
                      border: '1px solid rgba(6, 182, 212, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    ⚡ Current Demo Day
                  </span>
                )}
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                  }}
                >
                  {totalDayExams} {totalDayExams === 1 ? 'Exam' : 'Exams'}
                </span>
              </div>

              <span style={{ fontSize: '0.78rem', color: isCurrentDemoDay ? '#38bdf8' : 'var(--text-dim)', fontFamily: 'monospace', fontWeight: isCurrentDemoDay ? 700 : 400 }}>
                {dateStr}
              </span>
            </div>

            {/* Slots Grid */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '1rem'
              }}
            >
              {/* Morning Slot */}
              <div 
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  padding: '0.85rem'
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.4rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sunrise size={16} color="#fbbf24" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f9fafb' }}>
                      Morning Slot
                    </span>
                  </div>
                  {(() => {
                    const { rangeText, isCustom } = getSlotTimeDisplay(dayData.slots.MORNING, '09:30 AM - 12:30 PM', '09:30', '12:30');
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {isCustom && (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              padding: '0.08rem 0.35rem',
                              borderRadius: '4px',
                              background: 'rgba(6, 182, 212, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(6, 182, 212, 0.3)'
                            }}
                          >
                            Custom
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: isCustom ? '#38bdf8' : 'var(--text-muted)', fontWeight: isCustom ? 700 : 400 }}>
                          {rangeText}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {dayData.slots.MORNING.length > 0 ? (
                    dayData.slots.MORNING.map(renderExamCard)
                  ) : (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      No morning exams scheduled
                    </div>
                  )}
                </div>
              </div>

              {/* Afternoon Slot */}
              <div 
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '10px',
                  padding: '0.85rem'
                }}
              >
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.4rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sun size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f9fafb' }}>
                      Afternoon Slot
                    </span>
                  </div>
                  {(() => {
                    const { rangeText, isCustom } = getSlotTimeDisplay(dayData.slots.AFTERNOON, '02:00 PM - 05:00 PM', '14:00', '17:00');
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {isCustom && (
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              padding: '0.08rem 0.35rem',
                              borderRadius: '4px',
                              background: 'rgba(6, 182, 212, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(6, 182, 212, 0.3)'
                            }}
                          >
                            Custom
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: isCustom ? '#38bdf8' : 'var(--text-muted)', fontWeight: isCustom ? 700 : 400 }}>
                          {rangeText}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {dayData.slots.AFTERNOON.length > 0 ? (
                    dayData.slots.AFTERNOON.map(renderExamCard)
                  ) : (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      No afternoon exams scheduled
                    </div>
                  )}
                </div>
              </div>

              {/* Evening Slot (if any) */}
              {dayData.slots.EVENING.length > 0 && (
                <div 
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '10px',
                    padding: '0.85rem'
                  }}
                >
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.75rem',
                      paddingBottom: '0.4rem',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Moon size={16} color="#c084fc" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f9fafb' }}>
                        Evening Slot
                      </span>
                    </div>
                    {(() => {
                      const { rangeText, isCustom } = getSlotTimeDisplay(dayData.slots.EVENING, '05:30 PM - 08:30 PM', '17:30', '20:30');
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {isCustom && (
                            <span
                              style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              padding: '0.08rem 0.35rem',
                              borderRadius: '4px',
                              background: 'rgba(6, 182, 212, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(6, 182, 212, 0.3)'
                            }}
                          >
                            Custom
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', color: isCustom ? '#38bdf8' : 'var(--text-muted)', fontWeight: isCustom ? 700 : 400 }}>
                          {rangeText}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {dayData.slots.EVENING.map(renderExamCard)}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
