import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const DemoTimeContext = createContext(null);

const DEFAULT_DEMO_DATE = '2026-11-06';
const DEFAULT_DEMO_TIME = '10:30';

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes) {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60) % 24;
  const remMin = m % 60;
  return `${String(h).padStart(2, '0')}:${String(remMin).padStart(2, '0')}`;
}

export function normalizeDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    return dateVal.slice(0, 10);
  }
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

export function DemoTimeProvider({ children }) {
  const [demoDate, setDemoDateState] = useState(() => {
    try {
      const saved = localStorage.getItem('examsphere_demo_date');
      return saved ? normalizeDate(saved) : DEFAULT_DEMO_DATE;
    } catch {
      return DEFAULT_DEMO_DATE;
    }
  });

  const [demoTime, setDemoTimeState] = useState(() => {
    try {
      const saved = localStorage.getItem('examsphere_demo_time');
      return saved && saved.length >= 5 ? saved.slice(0, 5) : DEFAULT_DEMO_TIME;
    } catch {
      return DEFAULT_DEMO_TIME;
    }
  });

  const setDemoDate = useCallback((newDate) => {
    const norm = normalizeDate(newDate) || DEFAULT_DEMO_DATE;
    setDemoDateState(norm);
    try {
      localStorage.setItem('examsphere_demo_date', norm);
    } catch {}
  }, []);

  const setDemoTime = useCallback((newTime) => {
    const norm = newTime && newTime.length >= 5 ? newTime.slice(0, 5) : DEFAULT_DEMO_TIME;
    setDemoTimeState(norm);
    try {
      localStorage.setItem('examsphere_demo_time', norm);
    } catch {}
  }, []);

  const setDemoDateTime = useCallback((newDate, newTime) => {
    setDemoDate(newDate);
    setDemoTime(newTime);
  }, [setDemoDate, setDemoTime]);

  // Total elapsed minutes from midnight for current demo time
  const currentMinutes = useMemo(() => timeToMinutes(demoTime), [demoTime]);

  // Demo Date as a JavaScript Date instance
  const demoDateObj = useMemo(() => {
    try {
      const [y, m, d] = demoDate.split('-').map(Number);
      const [h, min] = demoTime.split(':').map(Number);
      return new Date(y, m - 1, d, h || 0, min || 0, 0);
    } catch {
      return new Date();
    }
  }, [demoDate, demoTime]);

  // Formatted date string (e.g., "Friday, Nov 6, 2026")
  const formatDemoDate = useCallback((options = {}) => {
    try {
      return demoDateObj.toLocaleDateString('en-US', {
        weekday: options.weekday !== undefined ? options.weekday : 'short',
        month: options.month !== undefined ? options.month : 'short',
        day: 'numeric',
        year: 'numeric',
        ...options
      });
    } catch {
      return demoDate;
    }
  }, [demoDateObj, demoDate]);

  // Formatted time string (e.g., "10:30 AM")
  const formatDemoTime = useCallback(() => {
    try {
      return demoDateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return demoTime;
    }
  }, [demoDateObj, demoTime]);

  // Progress status evaluator for any exam / duty slot:
  // 'ACTIVE' (currently in-session) | 'COMPLETED' (ended) | 'UPCOMING' (today later) | 'FUTURE' (future date) | 'PAST' (past date)
  const getSlotProgress = useCallback((examDate, startTime, endTime) => {
    const dStr = normalizeDate(examDate);
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);

    if (dStr < demoDate) {
      return 'PAST';
    }
    if (dStr > demoDate) {
      return 'FUTURE';
    }
    // Same day:
    if (startM <= currentMinutes && endM > currentMinutes) {
      return 'ACTIVE';
    }
    if (endM <= currentMinutes) {
      return 'COMPLETED';
    }
    return 'UPCOMING';
  }, [demoDate, currentMinutes]);

  const isSlotActive = useCallback((examDate, startTime, endTime) => {
    return getSlotProgress(examDate, startTime, endTime) === 'ACTIVE';
  }, [getSlotProgress]);

  const isSlotCompleted = useCallback((examDate, endTime) => {
    const progress = getSlotProgress(examDate, '00:00', endTime);
    return progress === 'PAST' || progress === 'COMPLETED';
  }, [getSlotProgress]);

  const value = useMemo(() => ({
    // Time & Date state (Global across all pages)
    demoDate,
    demoTime,
    currentDate: demoDate,
    currentTime: demoTime,
    currentMinutes,
    demoDateObj,

    // Setters
    setDemoDate,
    setDemoTime,
    setDemoDateTime,

    // Helpers
    formatDemoDate,
    formatDemoTime,
    timeToMinutes,
    minutesToTime,
    normalizeDate,
    getSlotProgress,
    isSlotActive,
    isSlotCompleted,

    // Common presets for easy demonstration
    presets: {
      dates: [
        { label: 'Nov 6 (Day 1)', value: '2026-11-06' },
        { label: 'Nov 9 (Day 2)', value: '2026-11-09' },
        { label: 'Nov 10 (Day 3)', value: '2026-11-10' },
        { label: 'Nov 11 (Day 4)', value: '2026-11-11' },
        { label: 'Nov 12 (Day 5)', value: '2026-11-12' }
      ],
      times: [
        { label: '09:00 (Pre-Exam)', value: '09:00' },
        { label: '10:30 (Morning Active)', value: '10:30' },
        { label: '13:00 (Post-Morning)', value: '13:00' },
        { label: '14:30 (Afternoon Active)', value: '14:30' },
        { label: '17:30 (Day Ended)', value: '17:30' }
      ]
    }
  }), [
    demoDate,
    demoTime,
    currentMinutes,
    demoDateObj,
    setDemoDate,
    setDemoTime,
    setDemoDateTime,
    formatDemoDate,
    formatDemoTime,
    getSlotProgress,
    isSlotActive,
    isSlotCompleted
  ]);

  return (
    <DemoTimeContext.Provider value={value}>
      {children}
    </DemoTimeContext.Provider>
  );
}

export function useDemoTime() {
  const ctx = useContext(DemoTimeContext);
  if (!ctx) {
    throw new Error('useDemoTime must be used within a DemoTimeProvider');
  }
  return ctx;
}

