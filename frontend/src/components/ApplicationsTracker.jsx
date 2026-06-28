import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Search, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { API_BASE } from '../lib/api';
import { initials } from '../lib/format';



const STATUS_META = {
  applied:   { label: 'Applied',   step: 1, tone: 'origin-ink-3' },
  reviewed:  { label: 'Reviewed',  step: 2, tone: 'origin-ink-2' },
  interview: { label: 'Interview', step: 3, tone: 'origin-acc' },
  offer:     { label: 'Offer',     step: 4, tone: 'origin-acc' },
  accepted:  { label: 'Accepted',  step: 4, tone: 'origin-acc' },
  rejected:  { label: 'Closed',    step: 0, tone: 'origin-ink-4' },
};

const PIPELINE = ['Applied', 'Reviewed', 'Interview', 'Offer'];

// ============================ pipeline strip ============================

function Pipeline({ status }) {
  const meta = STATUS_META[status] || STATUS_META.applied;
  return (
    <div className="flex items-center gap-1.5 mt-3">
      {PIPELINE.map((label, i) => {
        const idx = i + 1;
        const reached = idx <= meta.step;
        return (
          <div key={label} className="flex-1 flex flex-col gap-1.5">
            <div className={`h-1 rounded-full transition-all ${reached ? 'bg-origin-acc' : 'bg-origin-surface-2'}`} />
            <span className={`font-mono text-[10px] tracking-wider uppercase ${reached ? 'text-origin-acc' : 'text-origin-ink-4'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================ card ============================

function ApplicationCard({ app }) {
  const company = app.employer_org_name || app.employer_name || 'Company';
  const status = app.status || 'applied';
  const meta = STATUS_META[status] || STATUS_META.applied;
  const applied = useMemo(() => {
    if (!app.created_at) return null;
    const d = new Date(app.created_at);
    if (isNaN(d)) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [app.created_at]);

  return (
    <article className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-[10px] flex-none bg-origin-surface border border-origin-line-2 grid place-items-center font-display font-semibold text-[14px] text-origin-ink-2">
          {initials(company)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-medium text-[16px] tracking-tight text-origin-ink line-clamp-2">{app.job_title || 'Untitled role'}</div>
          <div className="text-[13px] text-origin-ink-3 mt-0.5">{company}</div>
        </div>
        <span className={`font-mono text-[11px] font-semibold tracking-wider uppercase py-1 px-2 rounded-md border whitespace-nowrap ${
          meta.tone === 'origin-acc'
            ? 'text-origin-acc bg-[oklch(0.86_0.19_142/0.1)] border-[oklch(0.86_0.19_142/0.28)]'
            : 'text-origin-ink-3 bg-origin-bg border-origin-line-2'
        }`}>
          {meta.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-[12.5px] text-origin-ink-3 font-mono">
        {app.job_location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {app.job_location}
          </span>
        )}
        {app.job_salary_range && <span>{app.job_salary_range}</span>}
        {applied && <span>Applied {applied}</span>}
      </div>

      {(app.job_skills || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {(app.job_skills || []).slice(0, 5).map((s) => (
            <span key={s} className="font-mono text-[11px] py-1 px-2 rounded-md border border-origin-line text-origin-ink-2 bg-origin-bg-soft">{String(s).toLowerCase()}</span>
          ))}
        </div>
      )}

      <Pipeline status={status} />
    </article>
  );
}

// ============================ summary chips ============================

const SummaryStat = ({ label, value, accent }) => (
  <div className={`flex-1 min-w-[110px] bg-origin-bg-soft border rounded-[12px] p-4 ${accent ? 'border-[oklch(0.86_0.19_142/0.3)]' : 'border-origin-line'}`}>
    <div className={`font-display font-medium text-[22px] tracking-tight ${accent ? 'text-origin-acc' : 'text-origin-ink'}`}>{value}</div>
    <div className="font-mono text-[10.5px] tracking-wider uppercase text-origin-ink-4 mt-1">{label}</div>
  </div>
);

// ============================ main ============================

export const ApplicationsTracker = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/jobs/my-applications`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setApps(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const out = { total: apps.length, applied: 0, reviewed: 0, interview: 0, accepted: 0 };
    for (const a of apps) {
      const s = a.status || 'applied';
      if (s === 'applied')                          out.applied++;
      else if (s === 'reviewed')                    out.reviewed++;
      else if (s === 'interview')                   out.interview++;
      else if (s === 'offer' || s === 'accepted')   out.accepted++;
    }
    return out;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter !== 'all' && (a.status || 'applied') !== statusFilter) return false;
      if (!q) return true;
      const hay = [a.job_title, a.employer_org_name, a.employer_name, a.job_location, ...(a.job_skills || [])]
        .filter(Boolean).map(String).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [apps, query, statusFilter]);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display font-medium text-[clamp(28px,4vw,38px)] tracking-tight">
          <span className="text-origin-acc">My</span> Applications
        </h1>
        <p className="mt-2 text-[15px] text-origin-ink-3 max-w-[60ch]">
          Track every job you've applied to and where each one stands in the pipeline.
        </p>
      </div>

      {/* summary stats */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryStat label="Total"     value={counts.total} />
        <SummaryStat label="Applied"   value={counts.applied} />
        <SummaryStat label="Reviewed"  value={counts.reviewed} />
        <SummaryStat label="Interview" value={counts.interview} accent={counts.interview > 0} />
        <SummaryStat label="Offer"     value={counts.accepted}  accent={counts.accepted > 0} />
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5 bg-origin-bg-soft border border-origin-line rounded-[11px] px-3.5 h-[42px] text-origin-ink-3 focus-within:border-origin-line-2 transition-colors flex-1 min-w-[220px]">
          <Search className="w-[17px] h-[17px] text-origin-ink-4 flex-none" />
          <input
            type="text"
            placeholder="Search by job title or company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-origin-ink font-[inherit] text-[14.5px] tracking-tight placeholder:text-origin-ink-4"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-origin-bg border border-origin-line-2 rounded-[10px] px-3.5 h-[42px] text-origin-ink text-[14px] font-[inherit] tracking-tight outline-none hover:border-origin-ink-4 focus:border-origin-acc transition cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="applied">Applied</option>
          <option value="reviewed">Reviewed</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Closed</option>
        </select>
      </div>

      {/* states */}
      {loading ? (
        <div className="grid place-items-center py-20 text-origin-ink-4">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <div className="font-mono text-xs tracking-wider uppercase">Loading…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-origin-bg-soft border border-origin-line rounded-[15px] py-16 px-8 text-center">
          <div className="w-[60px] h-[60px] mx-auto mb-5 rounded-[14px] grid place-items-center bg-origin-surface border border-origin-line-2 text-origin-ink-2">
            <Briefcase className="w-7 h-7" />
          </div>
          <h2 className="font-display font-medium text-[22px] tracking-tight text-origin-ink">
            {apps.length === 0 ? 'No applications yet' : 'No matches'}
          </h2>
          <p className="mt-2 text-[14px] text-origin-ink-3 max-w-[44ch] mx-auto">
            {apps.length === 0
              ? "Start applying to roles from the Jobs page — they'll show up here so you can track every step."
              : 'Try clearing the filters or search query.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(400px,1fr))]">
          {filtered.map((a) => <ApplicationCard key={a.id} app={a} />)}
        </div>
      )}
    </div>
  );
};

export default ApplicationsTracker;
