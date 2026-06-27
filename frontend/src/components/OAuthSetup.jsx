import React, { useState, useEffect, useMemo } from 'react';
import { Mail, User as UserIcon, AtSign, Check, ArrowRight, Github, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// Decode setup_token payload (JWT) — read-only display, no signature verify.
// The backend verifies the token when we submit.
const decodeJwt = (t) => {
  try {
    const p = (t || '').split('.')[1] || '';
    const padded = p.replace(/-/g, '+').replace(/_/g, '/').padEnd(p.length + (4 - (p.length % 4)) % 4, '=');
    return JSON.parse(atob(padded));
  } catch { return {}; }
};

const slugifyName = (n = '') =>
  n.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '').slice(0, 24);

export const OAuthSetup = ({ setupToken, onComplete }) => {
  const payload = useMemo(() => decodeJwt(setupToken), [setupToken]);
  const provider = payload.provider || 'oauth';
  const lockedEmail = payload.email || '';

  const [name, setName] = useState(payload.name || '');
  const [username, setUsername] = useState(slugifyName(payload.name || ''));
  const [isAvailable, setIsAvailable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!username) { setIsAvailable(null); setError(null); return; }
    if (username.length < 3) { setIsAvailable(false); setError('At least 3 characters'); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`${API_BASE}/users/check-username?username=${encodeURIComponent(username)}`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setIsAvailable(data.available);
          setError(data.available ? null : 'Username is taken');
        }
      } finally { if (!cancelled) setIsChecking(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username]);

  const canSubmit = isAvailable && !isChecking && !isSubmitting && name.trim().length >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/complete-oauth-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_token: setupToken,
          username,
          email: lockedEmail,
          name: name.trim(),
          password: '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onComplete(data.access_token);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || 'Failed to complete signup');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally { setIsSubmitting(false); }
  };

  const providerIcon = provider === 'github'
    ? <Github className="w-3.5 h-3.5" />
    : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.92h5.35c-.23 1.5-1.7 4.4-5.35 4.4-3.22 0-5.84-2.66-5.84-5.92S8.78 6.58 12 6.58c1.83 0 3.06.78 3.77 1.45l2.57-2.47C16.7 4.05 14.55 3.1 12 3.1A9.4 9.4 0 1 0 21.5 12c0-.6-.06-1.07-.15-.9Z"/></svg>;

  return (
    <div className="min-h-screen bg-origin-bg text-origin-ink font-[family-name:var(--font-display)]">
      {/* engineering grid backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.28]"
        style={{
          backgroundImage: 'linear-gradient(var(--color-origin-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-origin-line) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 60%)',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
        {/* LEFT — form */}
        <main className="flex flex-col justify-center px-6 md:px-12 lg:px-16 py-10">
          <div className="w-full max-w-[480px] mx-auto lg:mx-0">
            {/* brand */}
            <div className="inline-flex items-center gap-2.5 font-bold text-[19px] tracking-tight mb-10">
              <span className="w-[30px] h-[30px] rounded-full bg-origin-ink grid place-items-center">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-origin-bg)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M3.5 12 H8.6" /><circle cx="12" cy="12" r="3.3" /><path d="M15.4 12 H20.5" />
                </svg>
              </span>
              <span>origin</span>
            </div>

            <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-origin-ink-4">// Step 1 of 2 · Account</span>
            <h1 className="font-display font-medium text-[clamp(28px,4.5vw,38px)] leading-[1.05] tracking-tight mt-3">
              Pick your <span className="text-origin-acc">handle</span>.
            </h1>
            <p className="mt-3 text-[15px] text-origin-ink-3 max-w-[44ch]">
              You'll appear as <span className="font-mono text-origin-ink-2">@{username || 'username'}</span> across Origin. Everything else came from your {provider} account — you can edit your name now or later.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4.5">
              {/* email (locked) */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] tracking-[0.13em] uppercase text-origin-ink-3 inline-flex items-center gap-1.5">
                  Email
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] py-0.5 px-1.5 rounded bg-origin-surface text-origin-ink-3 border border-origin-line">
                    {providerIcon} verified
                  </span>
                </span>
                <div className="flex items-center gap-2.5 bg-origin-bg-soft border border-origin-line rounded-[10px] py-2.5 px-3.5 text-origin-ink-3 cursor-not-allowed">
                  <Mail className="w-4 h-4 text-origin-ink-4 flex-none" />
                  <span className="font-mono text-[13.5px] truncate">{lockedEmail || '—'}</span>
                </div>
              </label>

              {/* name */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] tracking-[0.13em] uppercase text-origin-ink-3">Display name</span>
                <div className="flex items-center gap-2.5 bg-origin-bg border border-origin-line-2 rounded-[10px] py-2.5 px-3.5 focus-within:border-origin-acc focus-within:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)] transition">
                  <UserIcon className="w-4 h-4 text-origin-ink-4 flex-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={60}
                    className="flex-1 bg-transparent border-0 outline-none text-origin-ink font-[inherit] text-[14.5px] placeholder:text-origin-ink-4"
                  />
                </div>
              </label>

              {/* username */}
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] tracking-[0.13em] uppercase text-origin-ink-3">Username</span>
                <div className={`flex items-center gap-2.5 bg-origin-bg border rounded-[10px] py-2.5 px-3.5 transition focus-within:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)] ${
                  error ? 'border-origin-danger focus-within:border-origin-danger' : 'border-origin-line-2 focus-within:border-origin-acc'
                }`}>
                  <AtSign className="w-4 h-4 text-origin-ink-4 flex-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24))}
                    placeholder="yourhandle"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    minLength={3}
                    maxLength={24}
                    required
                    className="flex-1 bg-transparent border-0 outline-none text-origin-ink font-mono text-[14px] placeholder:text-origin-ink-4"
                  />
                  {isChecking && <span className="w-3.5 h-3.5 border-[1.5px] border-origin-line-2 border-t-origin-acc rounded-full animate-spin flex-none" />}
                  {!isChecking && isAvailable && username && <Check className="w-4 h-4 text-origin-acc flex-none" />}
                </div>
                <p className={`text-[12.5px] mt-0.5 ${error ? 'text-[oklch(0.78_0.13_30)]' : 'text-origin-ink-4'}`}>
                  {error || (isAvailable && username ? 'Available!' : 'Lowercase letters, numbers, underscores. 3–24 chars.')}
                </p>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-[10px] font-display font-medium text-[15px] tracking-tight transition-all ${
                  canSubmit
                    ? 'bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.2_142)] cursor-pointer border-0'
                    : 'bg-origin-surface text-origin-ink-4 cursor-not-allowed border-0'
                }`}
              >
                {isSubmitting ? 'Creating your space…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        </main>

        {/* RIGHT — value rail */}
        <aside className="hidden lg:flex flex-col justify-center px-12 xl:px-16 py-10 border-l border-origin-line bg-origin-bg-soft">
          <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-origin-ink-4">// what's next</span>
          <h2 className="font-display font-medium text-[28px] leading-[1.1] tracking-tight mt-2">
            Build a portfolio that <span className="text-origin-acc">proves</span> what you ship.
          </h2>
          <p className="mt-3 text-[14px] text-origin-ink-3 max-w-[44ch]">
            We analyze your GitHub commits, surface the skills you actually use, and put you in front of teams hiring for them.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {[
              { k: '01', t: 'Connect your repos', d: 'We read commits + READMEs on your behalf using your GitHub quota.' },
              { k: '02', t: 'Verified skill graph', d: 'No self-claims — every skill is backed by code you wrote.' },
              { k: '03', t: 'Match to roles, not job posts', d: 'See where you stack up against live opportunities.' },
            ].map((b) => (
              <div key={b.k} className="flex gap-3.5 p-3.5 rounded-[10px] border border-origin-line bg-origin-bg">
                <span className="font-mono text-[11px] tracking-wider text-origin-acc">{b.k}</span>
                <div>
                  <div className="font-display font-medium text-[14px] tracking-tight">{b.t}</div>
                  <div className="text-[12.5px] text-origin-ink-3 mt-0.5">{b.d}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 inline-flex items-center gap-2 font-mono text-[11px] text-origin-ink-4">
            <Sparkles className="w-3.5 h-3.5 text-origin-acc" />
            Powered by Gemini · GitHub GraphQL · your own data
          </div>
        </aside>
      </div>
    </div>
  );
};

export default OAuthSetup;
