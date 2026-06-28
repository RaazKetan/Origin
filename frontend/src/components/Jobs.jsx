import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Filter, MapPin, Check, Briefcase, ArrowRight, Loader2, BookmarkPlus, X as XIcon,
} from 'lucide-react';
import { API_BASE } from '../lib/api';
import { initials } from '../lib/format';



// ============================ JobCard ============================

const fitLabel = (pct) =>
  pct >= 90 ? 'Strong fit'
  : pct >= 75 ? 'Good fit'
  : pct >= 60 ? 'Worth a look'
  : 'Long-shot';

function JobCard({ job, onApply, onOpen }) {
  const match = Math.round(job.visibility_score ?? job.final_match_score ?? job.match_score ?? 0);
  const company = job.employer_org_name || job.employer_name || 'Company';
  const skills = (job.skills || []).slice(0, 6);
  const isRemote = /remote/i.test(job.location || '');
  const postedLabel = useMemo(() => {
    if (!job.created_at) return null;
    const d = new Date(job.created_at);
    if (isNaN(d)) return null;
    return `Posted ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }, [job.created_at]);

  return (
    <article className="bg-origin-bg-soft border border-origin-line rounded-[15px] overflow-hidden hover:border-origin-line-2 transition-colors">
      {/* ribbon */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[oklch(0.86_0.19_142/0.06)] border-b border-[oklch(0.86_0.19_142/0.18)]">
        <span className="block w-1 h-3.5 rounded-full bg-origin-acc" />
        <span className="font-mono text-[11.5px] tracking-wider uppercase text-origin-acc">
          Opportunity{match > 0 && <> · <b className="font-semibold">{match}% match</b></>}
        </span>
      </div>

      <div className="p-5">
        {/* logo + title */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-[10px] flex-none bg-gradient-to-br from-origin-surface-2 to-origin-surface border border-origin-line-2 grid place-items-center font-display font-semibold text-[14px] text-origin-ink-2">
            {initials(company)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-medium text-[17px] tracking-tight text-origin-ink line-clamp-2">{job.title || 'Untitled role'}</div>
            <div className="text-[13.5px] text-origin-ink-3 mt-0.5">{company}</div>
          </div>
        </div>

        {/* meta */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {isRemote && <Tag tone="acc">Remote</Tag>}
          {job.location && <Tag>{job.location}</Tag>}
          {job.salary_range && <Tag>{job.salary_range}</Tag>}
          {postedLabel && <Tag>{postedLabel}</Tag>}
        </div>

        {/* skill tags */}
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {skills.map((s) => <Tag key={s}>{String(s).toLowerCase()}</Tag>)}
          </div>
        )}

        {/* foot */}
        <div className="flex items-center gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => onApply?.(job)}
            className="inline-flex items-center gap-2 text-[13px] font-medium tracking-tight py-2 px-3.5 rounded-md bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.19_142)] hover:-translate-y-px hover:shadow-[0_8px_24px_oklch(0.86_0.19_142/0.22)] transition-all border-0 cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => onOpen?.(job)}
            className="inline-flex items-center gap-2 text-[13px] font-medium tracking-tight py-2 px-3.5 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            Save
          </button>
          {match > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[12px] text-origin-acc">
              <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
              {fitLabel(match)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

const Tag = ({ children, tone }) => (
  <span className={`font-mono text-[11px] py-1 px-2 rounded-md border whitespace-nowrap ${
    tone === 'acc'
      ? 'text-origin-acc bg-[oklch(0.86_0.19_142/0.1)] border-[oklch(0.86_0.19_142/0.28)]'
      : 'text-origin-ink-2 bg-origin-bg-soft border-origin-line'
  }`}>
    {children}
  </span>
);

// ============================ details modal ============================

function JobDetails({ job, onClose, onApply }) {
  const [coverLetter, setCoverLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    await onApply?.(job.id, coverLetter);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-origin-bg-soft border border-origin-line rounded-[15px] w-full max-w-2xl max-h-[80vh] overflow-auto">
        <header className="sticky top-0 z-10 flex items-center gap-3 px-5 py-3.5 border-b border-origin-line bg-origin-bg-soft">
          <div className="font-mono text-xs tracking-[0.1em] uppercase text-origin-ink-4">JOB / <b className="text-origin-ink font-medium normal-case tracking-tight">{job.title}</b></div>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="w-8 h-8 grid place-items-center rounded-md text-origin-ink-3 hover:text-origin-ink hover:bg-origin-surface bg-transparent border-0 cursor-pointer">
            <XIcon className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5">
          <div className="text-[13.5px] text-origin-ink-3">{job.employer_org_name || job.employer_name || 'Company'} · {job.location || 'Remote'}</div>
          {job.salary_range && <div className="font-mono text-[12px] text-origin-acc mt-1">{job.salary_range}</div>}
          <p className="mt-4 text-[14px] leading-relaxed text-origin-ink-2 whitespace-pre-line">{job.description}</p>
          {job.requirements && (
            <>
              <h4 className="font-display font-medium mt-5 mb-2 text-origin-ink">Requirements</h4>
              <p className="text-[14px] leading-relaxed text-origin-ink-2 whitespace-pre-line">{job.requirements}</p>
            </>
          )}
          <div className="flex flex-wrap gap-1.5 mt-5">
            {(job.skills || []).map((s) => <Tag key={s}>{String(s).toLowerCase()}</Tag>)}
          </div>

          <h4 className="font-display font-medium mt-6 mb-2 text-origin-ink">Cover letter</h4>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={5}
            placeholder="Why are you a great fit for this role?"
            className="w-full font-[inherit] text-sm tracking-tight text-origin-ink bg-origin-bg border border-origin-line-2 rounded-[10px] py-2.5 px-3.5 outline-none placeholder:text-origin-ink-4 hover:border-origin-ink-4 focus:border-origin-acc focus:shadow-[0_0_0_3px_oklch(0.86_0.19_142/0.14)] focus:bg-origin-bg-soft transition"
          />

          <div className="flex justify-end gap-2.5 mt-4">
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-[13px] py-2 px-3.5 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all cursor-pointer">Cancel</button>
            <button type="button" onClick={submit} disabled={submitting} className="inline-flex items-center gap-2 text-[13px] font-medium py-2 px-3.5 rounded-md bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.19_142)] transition-all border-0 cursor-pointer disabled:opacity-50">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Submit application
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================ Jobs page ============================

export const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/jobs/feed`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setJobs(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) =>
      [j.title, j.description, j.location, j.employer_org_name, j.employer_name, ...(j.skills || [])]
        .filter(Boolean).map(String).join(' ').toLowerCase().includes(q)
    );
  }, [jobs, query]);

  const apply = async (jobOrId, coverLetter = '') => {
    const id = typeof jobOrId === 'object' ? jobOrId.id : jobOrId;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/jobs/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ job_id: id, cover_letter: coverLetter }),
    });
    if (res.ok) {
      setSelectedJob(null);
      alert('Application submitted!');
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Application failed: ${err.detail || res.status}`);
    }
  };

  return (
    <div className="w-full">
      {/* page head */}
      <div className="mb-6">
        <h1 className="font-display font-medium text-[clamp(28px,4vw,38px)] tracking-tight">
          <span className="text-origin-acc">Discover</span> Jobs
        </h1>
        <p className="mt-2 text-[15px] text-origin-ink-3 max-w-[60ch]">
          Curated opportunities matched to your skill set. Search, filter, and apply.
        </p>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2.5 bg-origin-bg-soft border border-origin-line rounded-[11px] px-3.5 h-[42px] text-origin-ink-3 focus-within:border-origin-line-2 transition-colors flex-1">
          <Search className="w-[17px] h-[17px] text-origin-ink-4 flex-none" />
          <input
            type="text"
            placeholder="Search jobs by title, skill, or keyword…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-origin-ink font-[inherit] text-[14.5px] tracking-tight placeholder:text-origin-ink-4"
          />
          <span className="font-mono text-[11px] text-origin-ink-4 border border-origin-line-2 rounded-[5px] py-0.5 px-1.5 hidden md:inline">⌘K</span>
        </div>
        <button type="button" className="inline-flex items-center gap-2 text-[14px] font-medium tracking-tight py-2.5 px-3.5 rounded-[9px] bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all cursor-pointer whitespace-nowrap">
          <Filter className="w-[15px] h-[15px]" />
          Filters
        </button>
      </div>

      {/* count line */}
      {!loading && filtered.length > 0 && (
        <div className="font-mono text-[12.5px] text-origin-ink-4 mb-4">
          Showing <b className="text-origin-acc">{filtered.length}</b> matched role{filtered.length === 1 ? '' : 's'}
        </div>
      )}

      {/* states */}
      {loading ? (
        <div className="grid place-items-center py-20 text-origin-ink-4">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <div className="font-mono text-xs tracking-wider uppercase">Loading roles…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-origin-bg-soft border border-origin-line rounded-[15px] py-16 px-8 text-center">
          <div className="w-[60px] h-[60px] mx-auto mb-5 rounded-[14px] grid place-items-center bg-origin-surface border border-origin-line-2 text-origin-ink-2">
            <Briefcase className="w-7 h-7" />
          </div>
          <h2 className="font-display font-medium text-[22px] tracking-tight text-origin-ink">No jobs found yet</h2>
          <p className="mt-2 text-[14px] text-origin-ink-3 max-w-[44ch] mx-auto">
            {query ? 'No matches for that search. Try fewer keywords.' : 'Check back later — our agents are constantly analyzing new roles and matching them to your verified skills.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
          {filtered.map((j) => (
            <JobCard key={j.id} job={j} onApply={apply} onOpen={(job) => setSelectedJob(job)} />
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetails job={selectedJob} onClose={() => setSelectedJob(null)} onApply={apply} />
      )}
    </div>
  );
};

export default Jobs;
