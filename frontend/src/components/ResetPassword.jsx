import React, { useState } from 'react';
import './LandingPage.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const OriginMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-origin-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 12 H8.6" />
    <circle cx="12" cy="12" r="3.3" />
    <path d="M15.4 12 H20.5" />
  </svg>
);

export const ResetPassword = ({ token, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || `Reset failed (${res.status})`);
      localStorage.setItem('token', body.access_token);
      // Clear the reset-password URL so refresh doesn't try to reuse the token
      window.history.replaceState({}, '', '/');
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="origin-landing">
      <div className="reset-stage">
        <div className="reset-card">
          <div className="brand" style={{ marginBottom: 18 }}>
            <span className="mk"><OriginMark /></span>
            <span>origin</span>
          </div>
          <h2>Set a new password</h2>
          <p className="lede">Pick something at least 8 characters long. After saving, you'll be signed in.</p>

          <form onSubmit={submit} autoComplete="on" style={{ marginTop: 22 }}>
            <div className="field">
              <label htmlFor="rp-new">New password</label>
              <input id="rp-new" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rp-confirm">Confirm</label>
              <input id="rp-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button type="submit" className="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
            {error && <div className="auth-error">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
};
