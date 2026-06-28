import React, { useMemo, useState } from 'react';
import { Search, Plus, MessageSquare, MapPin, Loader2, Sparkles } from 'lucide-react';
import { API_BASE } from '../lib/api';
import { initials } from '../lib/format';



const SUGGESTED_PROMPTS = [
  'Senior Rust engineer, distributed systems, remote EU',
  'Full-stack TypeScript engineer with realtime experience',
  'Staff backend engineer, payments and reliability, Berlin',
  'ML engineer with production LLM experience, Python',
];

// ============================ candidate card ============================

function CandidateCard({ candidate }) {
  const score = Math.round((candidate.match_score ?? 0) * 100);
  const skills = (candidate.skills || []).slice(0, 4);
  const extra = (candidate.skills || []).length - skills.length;

  return (
    <article className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-full grid place-items-center font-display font-medium text-[16px] text-origin-ink-2 bg-gradient-to-br from-origin-surface-2 to-origin-surface border border-origin-line-2 flex-none">
          {initials(candidate.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display font-medium text-[16.5px] tracking-tight flex items-center gap-2 flex-wrap">
            {candidate.name || 'Unknown'}
            <span className="inline-flex items-center font-mono text-[10.5px] font-semibold tracking-wider uppercase text-origin-acc bg-[oklch(0.86_0.19_142/0.12)] border border-[oklch(0.86_0.19_142/0.25)] rounded-md py-[3px] px-1.5">✓</span>
          </div>
          <div className="text-[13px] text-origin-ink-3 mt-0.5 truncate">{candidate.title || candidate.current_role || '—'}</div>
        </div>
        {score > 0 && (
          <div className="origin-score-ring w-[60px] h-[60px] relative grid place-items-center rounded-full flex-none" style={{ '--p': score }}>
            <span className="relative z-10 font-mono font-semibold text-[16px] text-origin-ink">{score}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4 text-[13px] flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-origin-acc">
          <i className="w-[7px] h-[7px] rounded-full bg-origin-acc shadow-[0_0_7px_var(--color-origin-acc)]" />
          Open to roles
        </span>
        {candidate.location && (
          <span className="inline-flex items-center gap-1.5 text-origin-ink-3">
            <MapPin className="w-3 h-3" />
            {candidate.location}
          </span>
        )}
      </div>

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {skills.map((s) => (
            <span key={s} className="font-mono text-[11px] py-1 px-2 rounded-md border border-origin-line text-origin-ink-2 bg-origin-bg-soft">{s}</span>
          ))}
          {extra > 0 && <span className="font-mono text-[11px] py-1 px-2 rounded-md border border-origin-line text-origin-ink-4 bg-origin-bg-soft">+{extra}</span>}
        </div>
      )}

      {candidate.summary && (
        <p className="mt-3 text-[13px] leading-relaxed text-origin-ink-3 line-clamp-2 text-pretty">{candidate.summary}</p>
      )}

      <div className="mt-4 pt-4 border-t border-origin-line flex items-center gap-3 font-mono text-[11px] text-origin-ink-4">
        <span className="tracking-wider uppercase whitespace-nowrap">12-mo activity</span>
        <div className="flex-1 flex items-end gap-[2px] h-6">
          {Array.from({ length: 16 }).map((_, i) => {
            const seed = ((candidate.id || 1) * 13 + i * 7) % 100;
            const h = 4 + (seed % 22);
            return <i key={i} className="flex-1 rounded-[1.5px] bg-origin-acc-dim" style={{ height: `${h}px` }} />;
          })}
        </div>
      </div>

      <div className="flex gap-2.5 mt-4">
        <button type="button" className="flex-1 inline-flex items-center justify-center gap-2 text-[13px] font-medium tracking-tight py-2 px-3.5 rounded-md bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.19_142)] transition-all border-0 cursor-pointer">
          View profile
        </button>
        <button type="button" className="flex-1 inline-flex items-center justify-center gap-2 text-[13px] font-medium tracking-tight py-2 px-3.5 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all cursor-pointer">
          <MessageSquare className="w-3.5 h-3.5" />
          Message
        </button>
      </div>
    </article>
  );
}

// ============================ main ============================

export const TalentSearch = () => {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('top'); // top | available | recent
  const [activeChips, setActiveChips] = useState([]);

  const runSearch = async (q) => {
    const query = (q ?? prompt).trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/talent/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Search failed (${res.status})`);
      }
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    if (!results) return null;
    const arr = [...results];
    if (tab === 'top') arr.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
    return arr;
  }, [results, tab]);

  // -------- HERO (pre-search) --------
  if (results === null && !loading) {
    return (
      <div className="w-full">
        <div className="max-w-[760px] mx-auto pt-8">
          <h1 className="font-display font-medium text-[clamp(32px,4.5vw,46px)] tracking-tight leading-tight text-center">
            Find your dream <span className="text-origin-acc">talent</span>
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-origin-ink-3 text-center max-w-[52ch] mx-auto text-pretty">
            Describe the skills and role you need. Our AI agent reads verified contribution history to surface the best-matched engineers.
          </p>

          <div className="mt-8 bg-origin-bg-soft border border-origin-line rounded-[18px] p-3">
            <div className="bg-origin-bg border border-origin-line-2 rounded-[14px] p-4 focus-within:border-origin-acc focus-within:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)] transition">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="e.g. Senior backend engineer with 5+ years in Rust and distributed systems, open to remote (EU)…"
                rows={4}
                className="w-full bg-transparent border-0 outline-none font-[inherit] text-[15px] tracking-tight text-origin-ink placeholder:text-origin-ink-4 resize-none"
              />
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="font-mono text-[11.5px] text-origin-ink-4">Verified skills only · ⌘↵ to search</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => runSearch()}
                  disabled={!prompt.trim()}
                  className="inline-flex items-center gap-2 text-[14px] font-medium tracking-tight py-2.5 px-4 rounded-[9px] bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.19_142)] hover:-translate-y-px hover:shadow-[0_8px_24px_oklch(0.86_0.19_142/0.22)] transition-all border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                >
                  <Sparkles className="w-4 h-4" />
                  Find talent
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => { setPrompt(q); runSearch(q); }}
                className="font-[inherit] text-[13px] font-medium text-origin-ink-2 bg-origin-bg-soft border border-origin-line rounded-lg py-2 px-3 hover:border-origin-line-2 hover:text-origin-ink cursor-pointer transition-all"
              >
                {q.split(',').slice(0, 2).join(' · ')}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -------- RESULTS --------
  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="font-display font-medium text-[clamp(28px,4vw,38px)] tracking-tight">Find engineers by proof</h1>
        <p className="mt-2 text-[15px] text-origin-ink-3 max-w-[60ch]">
          Search <span className="text-origin-acc">verified</span> skills and real contribution history — not keywords on a résumé.
        </p>
      </div>

      {/* search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2.5 bg-origin-bg-soft border border-origin-line rounded-[11px] px-3.5 h-[42px] text-origin-ink-3 focus-within:border-origin-line-2 transition-colors flex-1">
          <Search className="w-[17px] h-[17px] text-origin-ink-4 flex-none" />
          <input
            type="text"
            placeholder="Search by skill, stack, or role — e.g. Rust distributed systems"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            className="flex-1 bg-transparent border-0 outline-none text-origin-ink font-[inherit] text-[14.5px] tracking-tight placeholder:text-origin-ink-4"
          />
          <span className="font-mono text-[11px] text-origin-ink-4 border border-origin-line-2 rounded-[5px] py-0.5 px-1.5 hidden md:inline">⌘K</span>
        </div>
        <div className="inline-flex bg-origin-bg-soft border border-origin-line rounded-[10px] p-[3px] gap-[2px]">
          {[['top', 'Top signal'], ['available', 'Available'], ['recent', 'Recent']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`font-[inherit] text-[13px] font-medium tracking-tight rounded-[7px] py-1.5 px-3 cursor-pointer whitespace-nowrap transition-all border-0 ${
                tab === id ? 'bg-origin-surface-2 text-origin-ink' : 'text-origin-ink-3 hover:text-origin-ink bg-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* filter chips */}
      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        {['Rust', 'Distributed Systems', 'TypeScript', 'Go', 'Open to work'].map((c) => {
          const on = activeChips.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveChips((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}
              className={`font-[inherit] text-[13px] font-medium border rounded-lg py-1.5 px-3 cursor-pointer transition-all ${
                on ? 'bg-[oklch(0.86_0.19_142/0.1)] border-[oklch(0.86_0.19_142/0.28)] text-origin-acc' : 'bg-origin-bg-soft border-origin-line text-origin-ink-2 hover:border-origin-line-2 hover:text-origin-ink'
              }`}
            >
              {c}
            </button>
          );
        })}
        <button type="button" className="font-[inherit] text-[13px] font-medium border border-origin-line bg-origin-bg-soft rounded-lg py-1.5 px-3 cursor-pointer inline-flex items-center gap-1.5 text-origin-ink-2 hover:border-origin-line-2 hover:text-origin-ink">
          <Plus className="w-3 h-3" />
          Add filter
        </button>
        <div className="ml-auto font-mono text-[12.5px] text-origin-ink-4">
          {sorted ? <><b className="text-origin-acc">{sorted.length}</b> verified engineer{sorted.length === 1 ? '' : 's'}</> : null}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-lg border border-[oklch(0.7_0.16_25/0.4)] bg-[oklch(0.7_0.16_25/0.08)] text-[oklch(0.78_0.13_30)] text-[13px]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20 text-origin-ink-4">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <div className="font-mono text-xs tracking-wider uppercase">Reading contribution history…</div>
        </div>
      ) : sorted && sorted.length === 0 ? (
        <div className="bg-origin-bg-soft border border-origin-line rounded-[15px] py-16 px-8 text-center">
          <h2 className="font-display font-medium text-[20px] tracking-tight">No matches yet</h2>
          <p className="mt-2 text-[14px] text-origin-ink-3 max-w-[44ch] mx-auto">Loosen the prompt or run a fresh search.</p>
          <button
            type="button"
            onClick={() => { setResults(null); setPrompt(''); }}
            className="mt-4 inline-flex items-center gap-2 text-[13px] py-2 px-3.5 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all cursor-pointer"
          >
            New search
          </button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {(sorted || []).map((c) => <CandidateCard key={c.id} candidate={c} />)}
        </div>
      )}
    </div>
  );
};

export default TalentSearch;
