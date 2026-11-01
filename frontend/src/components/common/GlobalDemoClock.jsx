import React, { useState } from 'react';
import { useDemoTime } from '../../context/DemoTimeContext';
import { Clock, Calendar, Sparkles, ChevronDown, Check } from 'lucide-react';

export default function GlobalDemoClock({ compact = false }) {
  const {
    demoDate,
    demoTime,
    setDemoDate,
    setDemoTime,
    setDemoDateTime,
    formatDemoDate,
    formatDemoTime,
    presets
  } = useDemoTime();

  const [isOpenMenu, setIsOpenMenu] = useState(false);

  return (
    <div
      className="global-demo-clock"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)',
        borderRadius: '10px',
        padding: compact ? '0.25rem 0.5rem' : '0.35rem 0.75rem',
        position: 'relative'
      }}
      aria-label="Global Simulated Demo Time"
    >
      {/* Badge Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          color: '#38bdf8',
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
        title="Global Demo Time: All pages, exam statuses, duties, and attendance run on this simulated clock."
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#38bdf8',
            boxShadow: '0 0 8px #38bdf8',
            display: 'inline-block'
          }}
        />
        <span>Demo Clock:</span>
      </div>

      {/* Date Input */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <Calendar size={13} color="#94a3b8" />
        <input
          type="date"
          aria-label="Global Demo Date"
          value={demoDate}
          onChange={(e) => setDemoDate(e.target.value)}
          title="Change Global Demo Date"
          style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '0.25rem 0.45rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            colorScheme: 'dark',
            cursor: 'pointer',
            minHeight: '30px'
          }}
        />
      </div>

      {/* Time Input */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <Clock size={13} color="#94a3b8" />
        <input
          type="time"
          aria-label="Global Demo Time"
          value={demoTime}
          onChange={(e) => setDemoTime(e.target.value)}
          title="Change Global Demo Time"
          style={{
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '6px',
            color: '#f8fafc',
            padding: '0.25rem 0.45rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            colorScheme: 'dark',
            cursor: 'pointer',
            minHeight: '30px'
          }}
        />
      </div>

      {/* Presets Trigger Button */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsOpenMenu(prev => !prev)}
          style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '6px',
            color: '#38bdf8',
            padding: '0.25rem 0.5rem',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            cursor: 'pointer'
          }}
          title="Quick Jump to Exam Slots or Days"
        >
          <Sparkles size={12} />
          <span>Presets</span>
          <ChevronDown size={11} />
        </button>

        {/* Dropdown Menu for Quick Jump */}
        {isOpenMenu && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 9999,
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '10px',
              padding: '0.75rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 15px rgba(6, 182, 212, 0.25)',
              minWidth: '240px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {/* Exam Day Quick Jump */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Select Exam Day
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                {presets.dates.map(d => {
                  const isCurrent = d.value === demoDate;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        setDemoDate(d.value);
                        setIsOpenMenu(false);
                      }}
                      style={{
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        borderRadius: '5px',
                        background: isCurrent ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: isCurrent ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        color: isCurrent ? '#38bdf8' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{d.label}</span>
                      {isCurrent && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Quick Jump */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Select Time Slot
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {presets.times.map(t => {
                  const isCurrent = t.value === demoTime;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setDemoTime(t.value);
                        setIsOpenMenu(false);
                      }}
                      style={{
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textAlign: 'left',
                        borderRadius: '5px',
                        background: isCurrent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: isCurrent ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                        color: isCurrent ? '#34d399' : '#e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{t.label}</span>
                      {isCurrent && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

