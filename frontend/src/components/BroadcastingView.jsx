import React, { useEffect, useState } from 'react';
import { AlertTriangle, Mail, RefreshCw, Send } from 'lucide-react';
import { api } from '../api';

const statusStyle = {
  SENT: { color: '#166534', background: '#dcfce7', label: 'Sent' },
  PENDING: { color: '#92400e', background: '#fef3c7', label: 'Pending' },
  FAILED: { color: '#991b1b', background: '#fee2e2', label: 'Failed' }
};

export default function BroadcastingView() {
  const [form, setForm] = useState({ recipientEmail: '', examName: '', roomNumber: '', details: '' });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await api.getBroadcastLogs();
      setLogs(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || 'Could not load broadcast history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSending(true);
    try {
      const result = await api.sendEmergencyRoomChange(form);
      const status = result.data?.delivery_status;
      setNotice(status === 'SENT'
        ? `Email accepted by the mail provider for ${form.recipientEmail}.`
        : status === 'PENDING'
          ? 'Broadcast was logged, but the email provider is not configured yet.'
          : `Email delivery failed for ${form.recipientEmail}.`);
      setForm(current => ({ ...current, recipientEmail: '', details: '' }));
      await loadLogs();
    } catch (err) {
      setError(err.message || 'Could not send the broadcast.');
      await loadLogs();
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', border: '1px solid #394656', borderRadius: 8, font: 'inherit', color: '#e5eaf0', background: '#171e27' };
  const cardStyle = { background: '#171e27', border: '1px solid #303b49', borderRadius: 12, padding: '1.25rem', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.14)' };

  return (
    <section style={{ display: 'grid', gap: '1.25rem' }}>
      <header>
        <h2 style={{ margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: 10 }}><Mail size={22} /> Broadcasting</h2>
        <p style={{ color: '#a4afbd', margin: 0 }}>Send an emergency room change email to one recipient at a time.</p>
      </header>

      <form onSubmit={handleSubmit} style={cardStyle}>
        <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: 8, color: '#9a3412' }}><AlertTriangle size={18} /> Emergency room change</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Recipient email<input required type="email" value={form.recipientEmail} onChange={e => setForm({ ...form, recipientEmail: e.target.value })} placeholder="faculty@example.edu" style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Examination (optional)<input value={form.examName} onChange={e => setForm({ ...form, examName: e.target.value })} placeholder="Exam name" style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>New room<input required value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} placeholder="Room number" style={inputStyle} /></label>
          <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Additional instructions (optional)<textarea rows={3} value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} placeholder="Reason or directions" style={{ ...inputStyle, resize: 'vertical' }} /></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}><button type="submit" disabled={sending} className="btn btn-primary" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Send size={16} />{sending ? 'Sending…' : 'Send one email'}</button></div>
        {notice && <p role="status" style={{ color: '#166534', marginBottom: 0 }}>{notice}</p>}
        {error && <p role="alert" style={{ color: '#b91c1c', marginBottom: 0 }}>{error}</p>}
      </form>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: '1rem' }}><h3 style={{ margin: 0 }}>Notification log</h3><button type="button" onClick={loadLogs} disabled={loading} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={15} />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
        {logs.length === 0 ? <p style={{ color: '#64748b', margin: 0 }}>{loading ? 'Loading history…' : 'No broadcast emails have been logged yet.'}</p> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {logs.map(log => {
              const badge = statusStyle[log.delivery_status] || statusStyle.PENDING;
              return <article key={log.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, padding: '0.9rem', border: '1px solid #303b49', borderRadius: 9 }}>
                <div style={{ minWidth: 0 }}><strong>{log.subject}</strong><div style={{ color: '#a4afbd', marginTop: 4 }}>{log.recipient_email}</div><div style={{ color: '#a4afbd', fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{log.message}</div><small style={{ color: '#8290a0' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : 'Time unavailable'}{log.provider ? ` · ${log.provider}` : ''}</small>{log.error_message && <div style={{ color: '#f87171', fontSize: 13 }}>{log.error_message}</div>}</div>
                <span style={{ alignSelf: 'start', color: badge.color, background: badge.background, borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
              </article>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
