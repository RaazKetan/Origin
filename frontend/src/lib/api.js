// Single source of truth for the API base + auth token.
// Default is "/api" (same-origin in production). Local dev sets
// VITE_API_BASE_URL=http://localhost:8000/api in .env.local.

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export const getToken = () => localStorage.getItem('token');
export const setToken = (t) => localStorage.setItem('token', t);
export const clearToken = () => localStorage.removeItem('token');

export const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Thin fetch wrapper: prefixes API_BASE, attaches JSON + auth headers.
export const api = (path, opts = {}) =>
  fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
