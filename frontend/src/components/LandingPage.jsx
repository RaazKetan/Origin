import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './LandingPage.css';
import { Highlighter } from './magicui/highlighter';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const SAMPLE_CODE = `commit 8f3a12b
Author: DevUser <dev@origin.ai>
Date:   Wed Oct 25 14:30:00 2023 +0000

    refactor: implement recursive fiber tree traversal

    Replaced the iterative stack approach with a recursive
    solution to handle deeply nested component trees more
    gracefully. Added memoization to prevent re-rendering.

diff --git a/src/reconciler.ts b/src/reconciler.ts
index 4a12c..9b33d 100644
--- a/src/reconciler.ts
+++ b/src/reconciler.ts
@@ -45,12 +45,18 @@ function traverse(root: FiberNode) {
-  const stack = [root];
-  while (stack.length > 0) {
-    const node = stack.pop();
-    process(node);
-    if (node.child) stack.push(node.child);
-    if (node.sibling) stack.push(node.sibling);
-  }
+  if (!root) return;
+
+  // Memoize the process to avoid heavy recalc
+  const processed = useMemo(() => process(root), [root.props]);
+
+  if (root.child) traverse(root.child);
+  if (root.sibling) traverse(root.sibling);
 }
`;

const STAGE_LABELS = {
  IDLE: 'READY',
  READING_COMMITS: 'READING COMMITS',
  ANALYZING_PATTERNS: 'ANALYZING PATTERNS',
  GENERATING_PATH: 'GENERATING PATH',
  COMPLETE: 'COMPLETE',
};

// 53 weeks × 7 days, deterministic so it looks alive but stable across reloads.
function useContributionGrid() {
  return useMemo(() => {
    const STEPS = ['var(--g0)', 'var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)'];
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const cells = 53 * 7;
    const out = new Array(cells);
    for (let i = 0; i < cells; i++) {
      const r = rnd();
      let lvl = r < 0.34 ? 0 : r < 0.58 ? 1 : r < 0.78 ? 2 : r < 0.92 ? 3 : 4;
      const wk = Math.floor(i / 7);
      if (wk >= 14 && wk <= 18 && r < 0.7) lvl = Math.max(0, lvl - 2);
      out[i] = STEPS[lvl];
    }
    return out;
  }, []);
}

const OriginMark = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-origin-bg)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3.5 12 H8.6" />
    <circle cx="12" cy="12" r="3.3" />
    <path d="M15.4 12 H20.5" />
  </svg>
);

const GithubGlyph = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z" />
  </svg>
);

const VerifyGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    <circle cx="12" cy="12" r="4.2" />
  </svg>
);

const CheckGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const ArrowGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const GoogleGlyph = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 7.7-11.3 7.7-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.1 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.1z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2L31 33.3c-2 1.4-4.5 2.3-7 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.5 16.3 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.2-4.3 5.5l6.4 4.6C42.2 35.1 44 30 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);

export const LandingPage = ({ onLogin, onRegister, isLoading }) => {
  const grid = useContributionGrid();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [form, setForm] = useState({ name: '', identifier: '', email: '', password: '' });
  const [authError, setAuthError] = useState(null);
  const [forgotMsg, setForgotMsg] = useState(null);

  // Live commit-analyzer demo (calls the public /api/ai/analyze_commit endpoint
  // — Gemini key stays server-side).
  const [demoCode, setDemoCode] = useState(SAMPLE_CODE);
  const [demoStage, setDemoStage] = useState('IDLE');
  const [demoResult, setDemoResult] = useState(null);
  const [demoNote, setDemoNote] = useState(null);

  const runDemoAnalysis = useCallback(async () => {
    if (demoStage !== 'IDLE' && demoStage !== 'COMPLETE') return;
    setDemoNote(null);
    setDemoResult(null);
    setDemoStage('READING_COMMITS');
    // Faux-progress on the front so the stage bar feels alive while the API works.
    const t1 = setTimeout(() => setDemoStage((s) => (s === 'READING_COMMITS' ? 'ANALYZING_PATTERNS' : s)), 700);
    const t2 = setTimeout(() => setDemoStage((s) => (s === 'ANALYZING_PATTERNS' ? 'GENERATING_PATH' : s)), 1600);
    try {
      const res = await fetch(`${API_BASE}/ai/analyze_commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: demoCode }),
      });
      if (!res.ok) {
        if (res.status === 429) throw new Error('Demo cooldown — try again in a minute (rate limit).');
        throw new Error(`Analyzer returned ${res.status}`);
      }
      const data = await res.json();
      setDemoResult(data);
      setDemoStage('COMPLETE');
    } catch (err) {
      setDemoNote(err.message || 'Analyzer unavailable.');
      setDemoStage('IDLE');
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  }, [demoCode, demoStage]);

  // Make sure CSS vars used by inline graph cells exist on :root for the legend.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--g0', 'oklch(0.245 0.008 250)');
    root.setProperty('--g1', 'oklch(0.42 0.09 146)');
    root.setProperty('--g2', 'oklch(0.56 0.13 145)');
    root.setProperty('--g3', 'oklch(0.71 0.16 144)');
    root.setProperty('--g4', 'oklch(0.86 0.19 143)');
  }, []);

  const scrollToAuth = (mode) => {
    if (mode) setAuthMode(mode);
    const el = document.getElementById('auth');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setForgotMsg(null);
    try {
      if (authMode === 'login') {
        await onLogin(form.identifier, form.password);
      } else if (authMode === 'signup') {
        await onRegister(form.name, form.email, form.password);
      } else if (authMode === 'forgot') {
        const idValue = form.identifier || form.email;
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: idValue }),
        });
        const body = await res.json().catch(() => ({}));
        // Backend always returns the generic message — surface it as-is.
        setForgotMsg(body.message || 'If an account exists, we sent a reset link.');
      }
    } catch (err) {
      setAuthError(err?.message || 'Something went wrong. Try again.');
    }
  };

  const startOauth = (provider) => {
    // Backend OAuth start endpoint sends a 302 → provider auth URL.
    window.location.href = `${API_BASE}/auth/login/${provider}`;
  };

  return (
    <div className="origin-landing">
      <header className="site">
        <div className="wrap">
          <nav>
            <div className="brand">
              <span className="mk"><OriginMark /></span>
              <span>origin</span>
            </div>
            <div className="nav-links">
              <a href="#pipeline" className="hide">How it works</a>
              <a href="#demo" className="hide">Demo</a>
              <a href="#auth" className="hide" onClick={(e) => { e.preventDefault(); scrollToAuth('login'); }}>Log in</a>
              <span className="nav-sep hide"></span>
              <button type="button" className="btn btn-acc" onClick={() => scrollToAuth('signup')}>Get started</button>
            </div>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="dot"></span><b>PROOF, NOT PROMISES</b></span>
            <h1>Your résumé is the code you've <span className="hl"><b>already shipped.</b></span></h1>
            <p className="lede">
              Origin reads your real GitHub history, <em>verifies your skills with AI</em>, and routes
              you to roles that match what you can actually do — no keywords, no inflated bullet points.
            </p>
            <div className="cta">
              <button type="button" className="btn btn-acc" onClick={() => startOauth('github')}>
                <GithubGlyph />
                Connect GitHub
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => scrollToAuth('signup')}>
                View a sample profile →
              </button>
            </div>
            <div className="trust">
              <span className="lbl">Engineers verified at</span>
              <div className="marquee">
                <div className="marquee-track">
                  <span>STRIPE&nbsp;&nbsp;/&nbsp;&nbsp;VERCEL&nbsp;&nbsp;/&nbsp;&nbsp;LINEAR&nbsp;&nbsp;/&nbsp;&nbsp;RAMP&nbsp;&nbsp;/&nbsp;&nbsp;SUPABASE&nbsp;&nbsp;/&nbsp;&nbsp;FIGMA&nbsp;&nbsp;/&nbsp;&nbsp;NOTION</span>
                  <span>STRIPE&nbsp;&nbsp;/&nbsp;&nbsp;VERCEL&nbsp;&nbsp;/&nbsp;&nbsp;LINEAR&nbsp;&nbsp;/&nbsp;&nbsp;RAMP&nbsp;&nbsp;/&nbsp;&nbsp;SUPABASE&nbsp;&nbsp;/&nbsp;&nbsp;FIGMA&nbsp;&nbsp;/&nbsp;&nbsp;NOTION</span>
                </div>
              </div>
            </div>
          </div>

          <div className="proof">
            <div className="card">
              <div className="card-top">
                <div className="avatar">KR</div>
                <div className="who">
                  <div className="name">Ketan Raj <span className="verified">✓ VERIFIED</span></div>
                  <div className="handle">@21ketanraaz · founder</div>
                </div>
                <div className="score">
                  <div className="n">94<s>/100</s></div>
                  <div className="c">signal score</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-h">
                  <span className="t">Contribution history</span>
                  <span className="m">1,284 commits · 12mo</span>
                </div>
                <div className="graph">
                  {grid.map((bg, i) => <i key={i} style={{ background: bg }} />)}
                </div>
                <div className="legend">
                  Less <i className="g0" /><i className="g1" /><i className="g2" /><i className="g3" /><i className="g4" /> More
                </div>
              </div>

              <div className="skills">
                <div className="skill"><div className="s-name">Python <small>/ 7 repos</small></div><div className="bar"><i style={{ width: '95%' }} /></div><div className="pct">95</div></div>
                <div className="skill"><div className="s-name">React <small>/ 5 repos</small></div><div className="bar"><i style={{ width: '90%' }} /></div><div className="pct">90</div></div>
                <div className="skill"><div className="s-name">AI Agents</div><div className="bar"><i style={{ width: '92%' }} /></div><div className="pct">92</div></div>
                <div className="skill"><div className="s-name">FastAPI</div><div className="bar"><i style={{ width: '88%' }} /></div><div className="pct">88</div></div>
              </div>

              <div className="card-foot">
                <div className="stack"><span /><span /><span /></div>
                <div className="ft"><b>3 senior roles</b> matched this week</div>
                <span className="go"><ArrowGlyph /></span>
              </div>
            </div>
          </div>
        </section>

        <section className="pipe" id="pipeline">
          <div className="pipe-grid">
            <div className="pipe-head">
              <span className="k">// HOW IT WORKS</span>
              <h2>
                From commit history to a <Highlighter action="highlight" color="oklch(0.86 0.19 142 / 0.35)" isView>matched offer</Highlighter> - <Highlighter action="underline" color="var(--color-origin-acc)" isView>verified end to end</Highlighter>.
              </h2>
            </div>
            <div className="flow">
              <div className="node">
                <div className="ic"><GithubGlyph size={20} /></div>
                <div className="nt">Connect</div>
                <div className="nd">Read-only access to your public + private commit graph.</div>
              </div>
              <div className="beam" />
              <div className="node acc">
                <div className="ic"><VerifyGlyph /></div>
                <div className="nt">Verify</div>
                <div className="nd">AI agents analyze patterns and prove skills with evidence.</div>
              </div>
              <div className="beam b2" />
              <div className="node">
                <div className="ic"><CheckGlyph /></div>
                <div className="nt">Match</div>
                <div className="nd">Get routed to roles that fit your proven, real-world ability.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="demo" id="demo">
          <div className="pipe-head" style={{ marginBottom: 26 }}>
            <span className="k">// LIVE DEMO</span>
            <h2>Paste any commit. Watch the analyzer find the skills.</h2>
          </div>

          <div className="demo-grid">
            <div className="demo-code-card">
              <div className="demo-code-head">
                <span className="demo-dots"><i /><i /><i /></span>
                <span className="demo-file">commit.diff</span>
                <span className="demo-stage">
                  <span className={`stage-dot stage-${demoStage.toLowerCase()}`} />
                  {STAGE_LABELS[demoStage]}
                </span>
              </div>
              <textarea
                className="demo-code"
                spellCheck="false"
                value={demoCode}
                readOnly
                rows={18}
              />
              <div className="demo-actions">
                <span className="demo-hint mono">Sample commit · click run to analyze.</span>
                <button
                  type="button"
                  className="btn btn-acc"
                  onClick={runDemoAnalysis}
                  disabled={demoStage !== 'IDLE' && demoStage !== 'COMPLETE'}
                >
                  {demoStage === 'IDLE' || demoStage === 'COMPLETE' ? 'Analyze commit →' : 'Analyzing…'}
                </button>
              </div>
              {demoNote && <div className="demo-note">{demoNote}</div>}
            </div>

            <div className="demo-result-card">
              {!demoResult && demoStage === 'IDLE' && (
                <div className="demo-empty">
                  <span className="mono demo-empty-k">// AWAITING INPUT</span>
                  <p>Click <b>Analyze commit</b> to run the verifier on the snippet to the left.
                  Results show technical + soft skills, gaps, course suggestions, and a complexity score.</p>
                </div>
              )}

              {!demoResult && demoStage !== 'IDLE' && demoStage !== 'COMPLETE' && (
                <div className="demo-loading">
                  <span className={`stage-dot stage-${demoStage.toLowerCase()}`} />
                  <span className="mono">{STAGE_LABELS[demoStage]}…</span>
                </div>
              )}

              {demoResult && (
                <div className="demo-result">
                  <div className="card-top">
                    <div className="avatar">DX</div>
                    <div className="who">
                      <div className="name">DevUser <span className="verified">✓ ANALYZED</span></div>
                      <div className="handle">@devuser · commit 8f3a12b</div>
                    </div>
                    <div className="score">
                      <div className="n">{Math.round(demoResult.complexityScore ?? 0)}<s>/100</s></div>
                      <div className="c">complexity</div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-h">
                      <span className="t">Technical skills</span>
                      <span className="m">{(demoResult.technicalSkills || []).length} detected</span>
                    </div>
                    <div className="chips">
                      {(demoResult.technicalSkills || []).map((s, i) => (
                        <span className="chip chip-acc mono" key={`t-${i}`}>{s}</span>
                      ))}
                    </div>
                  </div>

                  {(demoResult.softSkills || []).length > 0 && (
                    <div className="panel">
                      <div className="panel-h">
                        <span className="t">Soft skills</span>
                      </div>
                      <div className="chips">
                        {demoResult.softSkills.map((s, i) => (
                          <span className="chip mono" key={`s-${i}`}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(demoResult.improvementAreas || []).length > 0 && (
                    <div className="panel">
                      <div className="panel-h">
                        <span className="t">Improvement areas</span>
                      </div>
                      <ul className="bullets">
                        {demoResult.improvementAreas.map((s, i) => <li key={`i-${i}`}>{s}</li>)}
                      </ul>
                    </div>
                  )}

                  {(demoResult.suggestedCourses || []).length > 0 && (
                    <div className="panel">
                      <div className="panel-h">
                        <span className="t">Suggested courses</span>
                      </div>
                      <ul className="courses">
                        {demoResult.suggestedCourses.map((c, i) => (
                          <li key={`c-${i}`}>
                            <span className="course-title">{c.title}</span>
                            <span className="course-meta mono">{c.platform}</span>
                            {c.reason && <p className="course-reason">{c.reason}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="stats">
          <div className="stat"><span className="n">10M+</span><span className="l">lines of code<br />analyzed</span></div>
          <div className="stat"><span className="n">85%</span><span className="l">interview-to-<br />placement rate</span></div>
          <div className="stat"><span className="n">24/7</span><span className="l">autonomous agent<br />mentorship</span></div>
        </section>

        <section className="auth-section" id="auth">
          <div className="auth-grid">
            <div className="auth-copy">
              <span className="eyebrow"><span className="dot" /><b>GET STARTED</b></span>
              <h2 style={{ marginTop: 18 }}>Bring your commits. Skip the keyword game.</h2>
              <p>
                One-click GitHub connect is the fastest way in — Origin reads your history,
                verifies your skills, and starts surfacing matched roles within minutes.
                Prefer email? That works too.
              </p>
            </div>

            <div className="auth-card">
              <div className="auth-tabs">
                <button type="button" className={authMode === 'login' ? 'is-active' : ''} onClick={() => { setAuthMode('login'); setAuthError(null); setForgotMsg(null); }}>Log in</button>
                <button type="button" className={authMode === 'signup' ? 'is-active' : ''} onClick={() => { setAuthMode('signup'); setAuthError(null); setForgotMsg(null); }}>Sign up</button>
              </div>

              {authMode !== 'forgot' && (
                <>
                  <div className="oauth-row">
                    <button type="button" className="btn-oauth" onClick={() => startOauth('github')}>
                      <GithubGlyph size={16} /> GitHub
                    </button>
                    <button type="button" className="btn-oauth" onClick={() => startOauth('google')}>
                      <GoogleGlyph /> Google
                    </button>
                  </div>
                  <div className="sep">or with {authMode === 'signup' ? 'email' : 'a password'}</div>
                </>
              )}

              <form onSubmit={submitAuth} autoComplete="on">
                {authMode === 'signup' && (
                  <>
                    <div className="field">
                      <label htmlFor="auth-name">Name</label>
                      <input
                        id="auth-name"
                        type="text"
                        autoComplete="name"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="auth-email">Email</label>
                      <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {authMode === 'login' && (
                  <div className="field">
                    <label htmlFor="auth-id">Username or email</label>
                    <input
                      id="auth-id"
                      type="text"
                      autoComplete="username"
                      required
                      value={form.identifier}
                      onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                    />
                  </div>
                )}

                {authMode === 'forgot' && (
                  <div className="field">
                    <label htmlFor="forgot-id">Username or email</label>
                    <input
                      id="forgot-id"
                      type="text"
                      autoComplete="username"
                      required
                      value={form.identifier}
                      onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                    />
                  </div>
                )}

                {authMode !== 'forgot' && (
                  <div className="field">
                    <label htmlFor="auth-pass">Password</label>
                    <input
                      id="auth-pass"
                      type="password"
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                )}

                <button type="submit" className="submit" disabled={isLoading}>
                  {isLoading
                    ? (authMode === 'login' ? 'Signing in…' : authMode === 'signup' ? 'Creating account…' : 'Sending…')
                    : (authMode === 'login' ? 'Sign in' : authMode === 'signup' ? 'Create account' : 'Send reset link')}
                </button>

                <div className="auth-footer-row">
                  {authMode === 'login' && (
                    <button type="button" className="auth-link" onClick={() => { setAuthMode('forgot'); setAuthError(null); setForgotMsg(null); }}>
                      Forgot password?
                    </button>
                  )}
                  {authMode === 'forgot' && (
                    <button type="button" className="auth-link" onClick={() => { setAuthMode('login'); setAuthError(null); setForgotMsg(null); }}>
                      ← Back to sign in
                    </button>
                  )}
                </div>

                {authError && <div className="auth-error">{authError}</div>}
                {forgotMsg && <div className="auth-ok">{forgotMsg}</div>}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="site">
        <div className="wrap foot">
          <span className="c">© 2026 Origin Labs</span>
          <span className="c">PROOF, NOT PROMISES.</span>
        </div>
      </footer>
    </div>
  );
};
