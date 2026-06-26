import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Star, GitFork, X as XIcon } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const MAX_SELECTED_REPOS = 5;

// `-o-` logo from the design — centered ring + line passing through both sides.
const OriginMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 12 H8.6" />
    <circle cx="12" cy="12" r="3.3" />
    <path d="M15.4 12 H20.5" />
  </svg>
);

const extractGithubUsername = (urlOrName) => {
  if (!urlOrName) return '';
  const s = String(urlOrName).trim().replace(/^@/, '');
  const m = s.match(/github\.com\/([A-Za-z0-9-]+)/i);
  return (m ? m[1] : s).replace(/\/$/, '');
};

// ----------------------- Shared chrome -----------------------

const Brand = () => (
  <div className="flex items-center justify-center gap-2.5 mb-9 font-bold text-[20px] tracking-tight">
    <span className="w-8 h-8 rounded-full bg-origin-ink grid place-items-center"><OriginMark /></span>
    <span>origin</span>
  </div>
);

const StepsRail = ({ active }) => (
  <div className="flex items-center justify-center gap-1.5 mb-7" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => (
      <i
        key={i}
        className={`h-1 rounded-full transition-all duration-300 ${
          i === active ? 'w-7 bg-origin-acc' : 'w-2.5 bg-origin-surface-2'
        }`}
      />
    ))}
  </div>
);

const Kicker = ({ children, className = '' }) => (
  <div className={`font-mono text-[11.5px] tracking-[0.18em] uppercase text-origin-ink-4 ${className}`}>
    {children}
  </div>
);

const Shell = ({ children, maxW = 'max-w-[560px]' }) => (
  <div className={`origin-grid min-h-screen bg-origin-bg text-origin-ink font-[family-name:var(--font-display)] antialiased grid place-items-center px-6 py-12`}>
    <div className={`relative z-10 w-full ${maxW}`}>
      {children}
    </div>
  </div>
);

const Btn = ({ variant = 'acc', size = 'md', className = '', children, ...rest }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium tracking-tight rounded-lg cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    md: 'text-sm py-2.5 px-4',
    lg: 'text-base py-3.5 px-5',
    sm: 'text-[13px] py-1.5 px-3 rounded-md',
  };
  const variants = {
    acc:   'bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.19_142)] hover:-translate-y-px hover:shadow-[0_8px_24px_oklch(0.86_0.19_142/0.22)]',
    ghost: 'bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4',
  };
  return (
    <button {...rest} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

// ----------------------- Form primitives (HOISTED) -----------------------
// IMPORTANT: keep these at module scope. Defining them inside ProfileSetup
// gives React a fresh component identity on every keystroke, which causes
// inputs to lose focus + visibly "swallow" what you type.

const Field = ({ label, optional, required, children, hint, className = '' }) => (
  <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
    <label className="text-[13px] font-medium tracking-tight text-origin-ink-2 flex items-center gap-1.5">
      {label}
      {required && <span className="text-origin-acc">*</span>}
      {optional && <span className="font-mono text-[10px] tracking-wider uppercase text-origin-ink-4 font-normal">Optional</span>}
    </label>
    {children}
    {hint && <span className="text-xs text-origin-ink-4 leading-snug">{hint}</span>}
  </div>
);

const Input = ({ className = '', ...rest }) => (
  <input
    {...rest}
    className={`w-full font-[inherit] text-sm tracking-tight text-origin-ink bg-origin-bg border border-origin-line-2 rounded-[10px] py-2.5 px-3.5 outline-none placeholder:text-origin-ink-4 hover:border-origin-ink-4 focus:border-origin-acc focus:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)] focus:bg-origin-bg-soft transition ${className}`}
  />
);

const Section = ({ idx, title, desc, required, children }) => (
  <section className="p-6 [&+&]:border-t [&+&]:border-origin-line">
    <div className="mb-5">
      <div className="font-display font-medium text-[17px] tracking-tight flex items-center gap-2.5">
        <span className="font-mono text-[11px] font-semibold text-origin-ink-4 bg-origin-surface border border-origin-line-2 rounded-md w-6 h-6 grid place-items-center flex-none">{idx}</span>
        {title}
        {required && <span className="text-origin-acc">*</span>}
      </div>
      {desc && <div className="mt-1.5 text-[13.5px] text-origin-ink-3">{desc}</div>}
    </div>
    {children}
  </section>
);

/**
 * Chips input. State lives in the parent — we pass it down as props.
 * Pass:
 *   values         current array of chips
 *   draft          string in the typing slot
 *   onDraftChange  (s) => void
 *   onAdd          () => void           commit the current draft
 *   onRemove       (v) => void
 *   onBackspaceEmpty   () => void       remove last chip when backspacing an empty draft
 */
const ChipsField = ({ label, hint, placeholder, optional, values, draft, onDraftChange, onAdd, onRemove, onBackspaceEmpty }) => (
  <Field label={label} optional={optional} hint={hint} className="col-span-2">
    <div className="flex flex-wrap gap-2 items-center bg-origin-bg border border-origin-line-2 rounded-[10px] py-2 px-2.5 min-h-[44px] transition focus-within:border-origin-acc focus-within:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)]">
      {values.map((v) => (
        <span key={v} className="inline-flex items-start gap-1.5 max-w-full min-w-0 break-words font-mono text-xs text-origin-acc bg-[oklch(0.86_0.19_142/0.1)] border border-[oklch(0.86_0.19_142/0.28)] rounded-md py-1 pl-2.5 pr-1.5">
          {v}
          <button type="button" aria-label="Remove" onClick={() => onRemove(v)}
                  className="grid place-items-center w-4 h-4 rounded text-origin-acc-2 hover:bg-[oklch(0.86_0.19_142/0.2)] hover:text-origin-acc bg-transparent border-0 cursor-pointer p-0">
            <XIcon className="w-2.5 h-2.5" strokeWidth={3} />
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder={values.length === 0 ? placeholder : ''}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); onAdd(); }
          else if (e.key === 'Backspace' && !draft && values.length) onBackspaceEmpty();
        }}
        onBlur={() => onAdd()}
        className="flex-1 min-w-[80px] bg-transparent border-0 outline-none text-origin-ink font-[inherit] text-[13.5px] placeholder:text-origin-ink-4"
      />
    </div>
  </Field>
);

// ----------------------- Component -----------------------

export const ProfileSetup = ({ onComplete }) => {
  const [step, setStep] = useState('welcome');
  const [setupMethod, setSetupMethod] = useState(null);
  const [, setResumeFile] = useState(null);
  const [, setParsedData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [portfolioResult, setPortfolioResult] = useState(null);
  const [error, setError] = useState(null);

  // Form data (skills/awards/certs are arrays so chips input works natively)
  const [formData, setFormData] = useState({
    githubProfileUrl: '',
    awards: [],
    skills: [],
    collegeName: '',
    collegeGpa: '',
    collegeYears: '',
    certifications: [],
    bio: '',
  });
  const [chipDrafts, setChipDrafts] = useState({ skills: '', awards: '', certifications: '' });

  // GitHub connect flow
  const [githubUsername, setGithubUsername] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [availableRepos, setAvailableRepos] = useState(null);
  const [selectedRepoUrls, setSelectedRepoUrls] = useState([]);
  const [repoLoadError, setRepoLoadError] = useState(null);

  // ------- Handlers -------
  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) return setError('Please upload a PDF file');
    if (file.size > 2 * 1024 * 1024) return setError(`File too large. Max 2 MB.`);

    setResumeFile(file);
    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API_BASE}/profile-setup/upload-resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        try { setError(`Failed to parse résumé: ${JSON.parse(t).detail || t}`); }
        catch { setError(`Failed to parse résumé: ${t}`); }
        return;
      }
      const data = await res.json();
      setParsedData(data);
      setFormData({
        githubProfileUrl: data.github_profile_url || '',
        awards: Array.isArray(data.awards) ? data.awards : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        collegeName: data.college_name || '',
        collegeGpa: data.college_gpa || '',
        collegeYears: data.college_years || '',
        certifications: Array.isArray(data.certifications) ? data.certifications : [],
        bio: '',
      });
      const parsedUsername = extractGithubUsername(data.github_profile_url);
      if (parsedUsername) setGithubUsername(parsedUsername);
      setStep('resume');
    } catch (err) {
      console.error(err);
      setError('Failed to upload résumé. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const loadGithubRepos = async () => {
    setRepoLoadError(null);
    const username = extractGithubUsername(githubUsername);
    if (!username) return setRepoLoadError('Please enter your GitHub username');
    setIsLoadingRepos(true);
    setAvailableRepos(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/github/repos?username=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const repos = await res.json();
        setAvailableRepos(repos);
        setGithubUsername(username);
        setSelectedRepoUrls((prev) => prev.filter((u) => repos.some((r) => r.url === u)));
      } else {
        const body = await res.json().catch(() => ({ detail: 'Failed to load repos' }));
        setRepoLoadError(body.detail || `Failed to load repos (${res.status})`);
      }
    } catch {
      setRepoLoadError('Network error loading repos. Try again.');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const toggleRepoSelection = (url) =>
    setSelectedRepoUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url)
        : prev.length >= MAX_SELECTED_REPOS ? prev : [...prev, url]
    );

  const handleCompleteProfile = async () => {
    setError(null);
    const username = extractGithubUsername(githubUsername);
    if (!username) return setError('Please enter your GitHub username and load your repos');
    if (!availableRepos) return setError('Click "Load my repos" to fetch your projects first');
    if (availableRepos.length > 0 && selectedRepoUrls.length === 0)
      return setError('Pick at least one repo (or up to 5) to analyze');

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setStep('analyzing');
    const progressInterval = setInterval(() => {
      setAnalysisProgress((p) => Math.min(p + 10, 90));
    }, 500);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/profile-setup/complete-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          setup_method: setupMethod,
          github_profile_url: `https://github.com/${username}`,
          selected_repos: selectedRepoUrls,
          awards: formData.awards,
          skills: formData.skills,
          college_name: formData.collegeName.trim(),
          college_gpa: formData.collegeGpa.trim(),
          college_years: formData.collegeYears.trim(),
          certifications: formData.certifications,
          bio: formData.bio.trim(),
        }),
      });
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      if (res.ok) {
        const u = await res.json();
        setPortfolioResult({ score: u.portfolio_score || 50, rank: u.portfolio_rank || 'Intermediate' });
        setStep('complete');
      } else {
        const body = await res.text();
        try { setError(`Profile setup failed: ${JSON.parse(body).detail || body}`); }
        catch { setError(`Profile setup failed: ${body}`); }
        setStep(setupMethod === 'resume' ? 'resume' : 'manual');
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error(err);
      setError('Network error. Try again.');
      setStep(setupMethod === 'resume' ? 'resume' : 'manual');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ============================ WELCOME ============================
  if (step === 'welcome') {
    const Item = ({ idx, required, icon, title, desc }) => (
      <div className="relative flex items-start gap-4 p-[18px] rounded-[13px] border border-transparent transition-colors hover:bg-origin-surface hover:border-origin-line">
        <div className={`w-[34px] h-[34px] flex-none rounded-[9px] grid place-items-center font-mono text-[13px] font-semibold mt-0.5 ${
          required
            ? 'text-origin-acc bg-[oklch(0.86_0.19_142/0.1)] border border-[oklch(0.86_0.19_142/0.3)]'
            : 'text-origin-ink-3 bg-origin-surface border border-origin-line-2'
        }`}>{idx}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-display font-medium text-[16.5px] tracking-tight text-origin-ink whitespace-nowrap">{title}</h3>
            <span className={`font-mono text-[10px] font-medium tracking-wider uppercase py-0.5 px-2 rounded-md border ${
              required ? 'text-origin-acc bg-[oklch(0.86_0.19_142/0.1)] border-[oklch(0.86_0.19_142/0.28)]'
                       : 'text-origin-ink-4 border-origin-line-2'
            }`}>{required ? 'Required' : 'Optional'}</span>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-origin-ink-3">{desc}</p>
        </div>
        <span className="ml-auto text-origin-ink-4 flex-none mt-1.5">{icon}</span>
      </div>
    );

    return (
      <Shell>
        <Brand />
        <StepsRail active={0} />

        <div className="text-center mb-8">
          <Kicker className="mb-3.5">// Step 1 of 4 · Profile setup</Kicker>
          <h1 className="font-display font-medium text-[clamp(30px,5vw,42px)] leading-[1.05] tracking-tight">Let's build your profile.</h1>
          <p className="mt-3.5 text-base leading-relaxed text-origin-ink-3 max-w-[40ch] mx-auto text-pretty">
            Three steps to a verified profile that proves what you can actually do — and routes you to the right collaborations.
          </p>
        </div>

        <div className="bg-origin-bg-soft border border-origin-line rounded-[18px] p-3 bg-[radial-gradient(130%_90%_at_50%_-10%,oklch(0.22_0.015_150_/0.4),transparent_55%)]">
          <Item idx="01" title="Upload your résumé" desc="We'll automatically extract your skills, education, and achievements." icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6M9 17h4" /></svg>
          } />
          <Item idx="02" required title="Link your GitHub" desc="Share your profile so our AI can analyze your best projects and verify your skills." icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z" /></svg>
          } />
          <Item idx="03" title="Get your portfolio score" desc="Receive a signal score and ranking based on your real projects and proven skills." icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5 11 15l4.5-5" /></svg>
          } />

          <div className="pt-3.5 px-1.5 pb-1.5">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="w-full font-display font-medium text-base tracking-tight bg-origin-acc text-origin-acc-ink border-0 rounded-xl py-4 cursor-pointer flex items-center justify-center gap-2.5 transition-all hover:bg-[oklch(0.9_0.19_142)] hover:-translate-y-px hover:shadow-[0_12px_34px_oklch(0.86_0.19_142/0.24)] active:translate-y-0 group"
            >
              Get started
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

      </Shell>
    );
  }

  // ============================ CHOICE / UPLOAD ============================
  if (step === 'choice') {
    return (
      <Shell>
        <Brand />
        <StepsRail active={1} />

        <div className="text-center mb-7">
          <Kicker className="mb-3.5">// Step 2 of 4 · Résumé</Kicker>
          <h1 className="font-display font-medium text-[clamp(28px,5vw,38px)] leading-[1.05] tracking-tight">Upload your résumé</h1>
          <p className="mt-3 text-base leading-relaxed text-origin-ink-3 max-w-[44ch] mx-auto text-pretty">
            We'll extract your skills, education, and experience automatically. You can review everything before it's saved.
          </p>
        </div>

        {error && <div className="mb-4 p-3.5 rounded-lg border border-[oklch(0.7_0.16_25/0.4)] bg-[oklch(0.7_0.16_25/0.08)] text-[oklch(0.78_0.13_30)] text-[13px]">{error}</div>}

        <div className="bg-origin-bg-soft border border-origin-line rounded-[18px] p-5">
          <label
            htmlFor="resume-upload"
            className="block border border-dashed border-origin-line-2 rounded-2xl bg-origin-bg px-7 py-9 text-center cursor-pointer transition-all hover:border-origin-acc hover:bg-[oklch(0.86_0.19_142/0.05)] group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) { setSetupMethod('resume'); handleResumeUpload({ target: { files: e.dataTransfer.files } }); }
            }}
          >
            <div className="w-[54px] h-[54px] mx-auto mb-3.5 rounded-[14px] grid place-items-center bg-origin-surface border border-origin-line-2 text-origin-ink-2 transition-all group-hover:text-origin-acc group-hover:bg-[oklch(0.86_0.19_142/0.08)] group-hover:border-[oklch(0.86_0.19_142/0.3)]">
              {isUploading ? <span className="w-6 h-6 border-2 border-origin-line-2 border-t-origin-acc rounded-full animate-spin" /> : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              )}
            </div>
            <div className="font-display font-medium text-base tracking-tight">
              {isUploading ? 'Parsing your résumé…' : <>Drop your résumé here, or <b className="text-origin-acc font-medium">browse</b></>}
            </div>
            <div className="text-[13px] text-origin-ink-4 mt-2">We never share your file — it's used only to build your profile.</div>
            <input id="resume-upload" type="file" accept=".pdf,application/pdf" className="hidden"
                   onChange={(e) => { setSetupMethod('resume'); handleResumeUpload(e); }} />
          </label>

          <div className="flex items-center justify-center gap-2.5 mt-4 flex-wrap">
            <span className="font-mono text-[11px] font-medium py-1 px-2.5 rounded-md border border-origin-line text-origin-ink-2 bg-origin-bg-soft">PDF</span>
            <span className="font-mono text-[11px] font-medium py-1 px-2.5 rounded-md border border-dashed border-origin-line text-origin-ink-2 bg-origin-bg-soft">Max 2 MB</span>
          </div>

          <div className="flex items-center gap-3.5 my-5 text-origin-ink-4 font-mono text-[11px] tracking-widest before:content-[''] before:flex-1 before:h-px before:bg-origin-line after:content-[''] after:flex-1 after:h-px after:bg-origin-line">OR</div>

          <Btn variant="ghost" className="w-full py-3.5" onClick={() => { setSetupMethod('manual'); setStep('manual'); }} disabled={isUploading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            Enter details manually
          </Btn>
        </div>

        <button type="button" className="block w-full text-center mt-4 text-origin-ink-4 text-[13.5px] hover:text-origin-ink-2 bg-transparent border-0 cursor-pointer"
                onClick={() => setStep('welcome')}>← Back</button>
      </Shell>
    );
  }

  // ============================ RESUME / MANUAL FORM ============================
  if (step === 'resume' || step === 'manual') {
    const addChip = (field) => {
      const draft = (chipDrafts[field] || '').trim().replace(/,$/, '').trim();
      if (!draft) return;
      if (!formData[field].includes(draft))
        setFormData({ ...formData, [field]: [...formData[field], draft] });
      setChipDrafts({ ...chipDrafts, [field]: '' });
    };
    const removeChip = (field, v) => setFormData({ ...formData, [field]: formData[field].filter((x) => x !== v) });
    const onChipKeyDown = (field, e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(field); }
      else if (e.key === 'Backspace' && !chipDrafts[field] && formData[field].length)
        setFormData({ ...formData, [field]: formData[field].slice(0, -1) });
    };

    // Helper to keep call sites tidy — all chips fields share the same props.
    const chipsProps = (field) => ({
      values: formData[field],
      draft: chipDrafts[field],
      onDraftChange: (v) => setChipDrafts({ ...chipDrafts, [field]: v }),
      onAdd: () => addChip(field),
      onRemove: (v) => removeChip(field, v),
      onBackspaceEmpty: () => setFormData({ ...formData, [field]: formData[field].slice(0, -1) }),
    });

    return (
      <div className="origin-grid min-h-screen bg-origin-bg text-origin-ink font-[family-name:var(--font-display)] antialiased">
        <div className="relative z-10 max-w-[760px] mx-auto px-6 py-10 pb-16">
          <Brand />
          <StepsRail active={2} />

          <div className="text-center mb-6">
            <Kicker className="mb-3.5">// Step 3 of 4 · Your details</Kicker>
            <h1 className="font-display font-medium text-[clamp(28px,5vw,38px)] leading-[1.05] tracking-tight">
              {step === 'resume' ? 'Review your information' : 'Tell us about you'}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-origin-ink-3 max-w-[46ch] mx-auto text-pretty">
              {step === 'resume' ? "We pre-filled this from your résumé — tweak anything that looks off." : 'Add your details manually. Everything here can be edited later from your profile.'}
            </p>
          </div>

          {error && <div className="mb-4 p-3.5 rounded-lg border border-[oklch(0.7_0.16_25/0.4)] bg-[oklch(0.7_0.16_25/0.08)] text-[oklch(0.78_0.13_30)] text-[13px]">{error}</div>}

          <form className="bg-origin-bg-soft border border-origin-line rounded-[15px]" onSubmit={(e) => { e.preventDefault(); handleCompleteProfile(); }}>
            <Section idx="01" required title="Connect GitHub" desc="Required. We'll load your public repos so you can pick the ones we should analyze.">
              <Field label="Your GitHub username">
                <div className="flex gap-2.5">
                  <div className="relative flex items-center flex-1">
                    <span className="absolute left-3.5 text-origin-ink-4 pointer-events-none">@</span>
                    <Input
                      placeholder="your-github-username"
                      value={githubUsername}
                      onChange={(e) => {
                        setGithubUsername(e.target.value.replace(/[^A-Za-z0-9-]/g, ''));
                        if (availableRepos !== null) { setAvailableRepos(null); setSelectedRepoUrls([]); }
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadGithubRepos(); } }}
                      className="pl-9"
                    />
                  </div>
                  <Btn variant="ghost" size="sm" type="button" onClick={loadGithubRepos} disabled={isLoadingRepos || !githubUsername.trim()} className="px-4">
                    {isLoadingRepos ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : availableRepos ? 'Reload' : 'Load my repos'}
                  </Btn>
                </div>
                {repoLoadError && <span className="text-xs text-origin-danger mt-1">{repoLoadError}</span>}
              </Field>

              {availableRepos && availableRepos.length === 0 && (
                <div className="mt-3.5 p-3 rounded-lg border border-origin-line bg-origin-surface text-[13px] text-origin-ink-2">
                  No public repos found for @{githubUsername}. Make a repo public or pick a different username.
                </div>
              )}

              {availableRepos && availableRepos.length > 0 && (
                <>
                  <div className="mt-3.5 mb-2 font-mono text-[11px] text-origin-ink-4">{selectedRepoUrls.length}/{MAX_SELECTED_REPOS} selected</div>
                  <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {availableRepos.map((repo) => {
                      const checked = selectedRepoUrls.includes(repo.url);
                      const atCap = !checked && selectedRepoUrls.length >= MAX_SELECTED_REPOS;
                      return (
                        <label key={repo.url}
                               className={`flex items-start gap-3 p-3 rounded-[11px] border bg-origin-bg cursor-pointer transition-all ${
                                 checked ? 'border-origin-acc bg-[oklch(0.86_0.19_142/0.06)]'
                                         : 'border-origin-line-2 hover:border-origin-ink-4'
                               } ${atCap ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="checkbox" checked={checked} disabled={atCap} onChange={() => toggleRepoSelection(repo.url)} className="mt-1 accent-origin-acc" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <b className="font-semibold text-origin-ink text-sm tracking-tight">{repo.name}</b>
                              {repo.is_fork && <span className="font-mono text-[10px] py-0.5 px-1.5 rounded bg-origin-surface-2 text-origin-ink-4">fork</span>}
                            </div>
                            {repo.description && <div className="text-[12.5px] text-origin-ink-3 mt-1 leading-snug">{repo.description}</div>}
                            <div className="flex items-center gap-3 mt-1.5 font-mono text-[11px] text-origin-ink-4">
                              {repo.language && <span>{repo.language}</span>}
                              <span className="inline-flex items-center gap-1"><Star className="w-3 h-3" /> {repo.stars}</span>
                              <span className="inline-flex items-center gap-1"><GitFork className="w-3 h-3" /> {repo.forks}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </Section>

            <Section idx="02" title="Bio" desc="A short summary of what you build and care about.">
              <Field label="About you" optional hint="This shows under your name on your profile.">
                <textarea
                  className="w-full font-[inherit] text-sm tracking-tight text-origin-ink bg-origin-bg border border-origin-line-2 rounded-[10px] py-2.5 px-3.5 outline-none min-h-[96px] leading-relaxed resize-y placeholder:text-origin-ink-4 hover:border-origin-ink-4 focus:border-origin-acc focus:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)] focus:bg-origin-bg-soft transition"
                  placeholder="A short summary of what you build and care about…"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              </Field>
            </Section>

            <Section idx="03" title="Skills" desc="What you work with. We'll verify these against your GitHub.">
              <div className="grid grid-cols-2 gap-4">
                <ChipsField {...chipsProps('skills')} label="Your skills" placeholder="Type a skill and press Enter…" hint="Press Enter or comma to add. Verified skills get a ✓ on your profile." />
              </div>
            </Section>

            <Section idx="04" title="Education" desc="Where you studied. All fields optional.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="College or university" optional className="col-span-2">
                  <Input placeholder="e.g. IIT Bombay" value={formData.collegeName} onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })} />
                </Field>
                <Field label="GPA" optional>
                  <Input placeholder="3.8 / 4.0" value={formData.collegeGpa} onChange={(e) => setFormData({ ...formData, collegeGpa: e.target.value })} />
                </Field>
                <Field label="Years" optional>
                  <Input placeholder="2020 – 2024" value={formData.collegeYears} onChange={(e) => setFormData({ ...formData, collegeYears: e.target.value })} />
                </Field>
              </div>
            </Section>

            <Section idx="05" title="Awards & certifications" desc="Anything you've won or earned. Press Enter to add each one.">
              <div className="grid grid-cols-2 gap-4">
                <ChipsField {...chipsProps('awards')} label="Awards & activities" optional placeholder="e.g. Hackathon winner, Dean's List" />
                <ChipsField {...chipsProps('certifications')} label="Certifications" optional placeholder="e.g. AWS Certified Developer" />
              </div>
            </Section>

            <div className="flex items-center gap-3 py-4.5 px-6 border-t border-origin-line bg-origin-bg-soft rounded-b-[15px]">
              <span className="font-mono text-[11px] text-origin-ink-4 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Draft kept
              </span>
              <div className="flex-1" />
              <Btn variant="ghost" type="button" onClick={() => setStep('choice')}>Back</Btn>
              <Btn variant="acc" type="submit">
                Save & continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Btn>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ============================ ANALYZING ============================
  if (step === 'analyzing') {
    const logSteps = [
      { label: `Cloning ${selectedRepoUrls.length || 'your'} repositories`, meta: `${selectedRepoUrls.length || 0} repos` },
      { label: 'Reading code patterns', meta: 'parsed' },
      { label: 'Verifying skills', meta: `${formData.skills.length} skills` },
      { label: 'Computing signal score', meta: 'done' },
    ];
    const activeIdx = analysisProgress >= 100 ? 4 : analysisProgress >= 75 ? 3 : analysisProgress >= 50 ? 2 : analysisProgress >= 25 ? 1 : 0;

    return (
      <Shell>
        <Brand />
        <StepsRail active={3} />

        <Kicker className="text-center mb-3.5">// Step 4 of 4 · Analysis</Kicker>
        <h1 className="text-center font-display font-medium text-[clamp(28px,5vw,40px)] leading-[1.05] tracking-tight">Analyzing your work</h1>
        <p className="mt-3 text-base leading-relaxed text-origin-ink-3 text-center max-w-[42ch] mx-auto text-pretty">
          Our AI agents are reading your repositories to verify your skills and compute your signal score.
        </p>

        <div className="mt-8 bg-origin-bg-soft border border-origin-line rounded-[18px] px-7 py-8">
          {/* Orb */}
          <div className="w-[88px] h-[88px] mx-auto mb-2 relative grid place-items-center" aria-hidden="true">
            <span className="origin-ripple" /><span className="origin-ripple origin-ripple-delay" />
            <span className="w-16 h-16 rounded-full grid place-items-center text-origin-acc-ink shadow-[0_0_40px_oklch(0.86_0.19_142/0.5)]" style={{ background: 'radial-gradient(circle at 35% 30%, var(--color-origin-acc), var(--color-origin-acc-2))' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'origin-spin 3.4s linear infinite' }}>
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
                <circle cx="12" cy="12" r="3.4" />
              </svg>
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-0.5">
            {logSteps.map((s, i) => {
              const isDone = i < activeIdx;
              const isActive = i === activeIdx;
              const baseTone = isDone ? 'text-origin-ink-2' : isActive ? 'text-origin-acc bg-[oklch(0.86_0.19_142/0.06)]' : 'text-origin-ink-4';
              return (
                <div key={i} className={`flex items-center gap-3 py-2.5 px-3 rounded-[10px] text-sm transition-all ${baseTone}`}>
                  <span className={`w-5 h-5 rounded-full border-[1.5px] grid place-items-center flex-none ${
                    isDone ? 'bg-origin-acc border-origin-acc text-origin-acc-ink'
                           : isActive ? 'border-origin-acc' : 'border-current'
                  }`}>
                    {isDone && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                    {isActive && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: 'origin-spin 1s linear infinite' }}><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                  </span>
                  {s.label}
                  <span className={`ml-auto font-mono text-[11.5px] text-origin-ink-4 transition-opacity ${isDone ? 'opacity-100' : 'opacity-0'}`}>{s.meta}</span>
                </div>
              );
            })}
          </div>

          <div className="h-1.5 rounded-full bg-origin-surface-2 overflow-hidden mt-6">
            <i className="block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${analysisProgress}%`, background: 'linear-gradient(90deg, var(--color-origin-acc-dim), var(--color-origin-acc))' }} />
          </div>
          <div className="text-center font-mono text-xs text-origin-ink-4 mt-3">Analyzing — <b className="text-origin-acc">{analysisProgress}%</b></div>
        </div>

        <p className="text-center mt-5 text-[13px] text-origin-ink-4">This usually takes under a minute.</p>
      </Shell>
    );
  }

  // ============================ COMPLETE (REVEAL) ============================
  if (step === 'complete') {
    const target = portfolioResult ? Math.max(0, Math.min(100, Number(portfolioResult.score) || 0)) : 0;
    return <CompleteView target={target} rank={portfolioResult?.rank} skillsCount={formData.skills.length} reposCount={selectedRepoUrls.length} onContinue={onComplete} />;
  }

  return null;
};

// ----------------------- Reveal view -----------------------

function CompleteView({ target, rank, skillsCount, reposCount, onContinue }) {
  const [displayed, setDisplayed] = useState(0);
  const [ringPct, setRingPct] = useState(0);
  const redirectedRef = useRef(false);

  useEffect(() => { const r = requestAnimationFrame(() => setRingPct(target)); return () => cancelAnimationFrame(r); }, [target]);
  useEffect(() => {
    let raf; const start = performance.now(); const dur = 1600;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  useEffect(() => {
    const t = setTimeout(() => { if (!redirectedRef.current) { redirectedRef.current = true; onContinue?.(); } }, 6000);
    return () => clearTimeout(t);
  }, [onContinue]);

  const tierLabel = rank
    ? (rank === 'Expert' ? 'Top 5% · Expert'
      : rank === 'Advanced' ? 'Top 15% · Advanced'
      : rank === 'Intermediate' ? 'Top 40% · Intermediate'
      : rank)
    : (target >= 80 ? 'Top 6% · Senior' : target >= 60 ? 'Top 25% · Mid' : 'Building up');

  return (
    <div className="origin-grid min-h-screen bg-origin-bg text-origin-ink font-[family-name:var(--font-display)] antialiased grid place-items-center px-6 py-12">
      <div className="relative z-10 w-full max-w-[560px]">
        <Brand />
        <StepsRail active={3} />

        <div className="animate-[origin-fade-up_.6s_cubic-bezier(0.22,1,0.36,1)_both]">
          <div className="w-16 h-16 rounded-full mx-auto mb-5 grid place-items-center bg-[oklch(0.86_0.19_142/0.12)] border border-[oklch(0.86_0.19_142/0.3)] text-origin-acc">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5 11 15l4.5-5" /></svg>
          </div>
          <Kicker className="text-center mb-3.5">// Profile complete</Kicker>
          <h1 className="text-center font-display font-medium text-[clamp(28px,5vw,40px)] leading-[1.05] tracking-tight">You're verified.</h1>
          <p className="mt-3 text-base leading-relaxed text-origin-ink-3 text-center max-w-[42ch] mx-auto text-pretty">Your profile is live and ready. Here's your signal score.</p>

          <div className="mt-7 bg-origin-bg-soft border border-origin-line rounded-[20px] px-7 py-8 text-center relative overflow-hidden bg-[radial-gradient(130%_90%_at_50%_-10%,oklch(0.3_0.06_150/0.4),transparent_55%)]">
            <div className="font-mono text-[11px] tracking-widest uppercase text-origin-ink-4">Your signal score</div>

            <div className="origin-score-ring w-[184px] h-[184px] mx-auto mt-5 relative grid place-items-center rounded-full" style={{ '--p': ringPct }}>
              <div className="relative z-10">
                <div className="font-display font-semibold text-[60px] tracking-tighter leading-none text-origin-ink">{displayed}</div>
                <div className="font-mono text-[13px] text-origin-ink-4 mt-1">/ 100</div>
              </div>
            </div>

            <div className="inline-flex items-center gap-2.5 mt-5 font-display font-medium text-[15px] text-origin-acc bg-[oklch(0.86_0.19_142/0.12)] border border-[oklch(0.86_0.19_142/0.3)] rounded-full py-2 px-4">
              <span className="w-2 h-2 rounded-full bg-origin-acc shadow-[0_0_10px_var(--color-origin-acc)]" />
              {tierLabel}
            </div>

            <div className="grid grid-cols-3 gap-px mt-6 border border-origin-line rounded-[13px] overflow-hidden bg-origin-line">
              {[
                { n: skillsCount, l: 'Verified skills' },
                { n: reposCount, l: 'Repos analyzed' },
                { n: 0, l: 'Matched roles' },
              ].map((b, i) => (
                <div key={i} className="bg-origin-bg-soft px-3 py-4">
                  <div className="font-display font-medium text-xl tracking-tight">{b.n}</div>
                  <div className="font-mono text-[10px] tracking-wider uppercase text-origin-ink-4 mt-1 leading-tight">{b.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-2.5">
            <Btn variant="ghost" type="button" onClick={onContinue} className="flex-1 py-3.5">Browse roles</Btn>
            <Btn variant="acc" type="button" onClick={onContinue} className="flex-1 py-3.5">
              View my profile
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Btn>
          </div>
          <div className="text-center mt-4.5 font-mono text-xs text-origin-ink-4 flex items-center justify-center gap-2.5">
            <span className="w-[13px] h-[13px] border-[1.5px] border-origin-line-2 border-t-origin-acc rounded-full animate-spin" />
            Taking you to your profile…
          </div>
        </div>
      </div>
    </div>
  );
}
