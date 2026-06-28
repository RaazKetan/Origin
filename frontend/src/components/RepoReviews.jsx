import React, { useEffect, useState } from 'react';
import { GitBranch, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE } from '../lib/api';
import { langColor } from '../lib/format';



// One repo card with the agent's review.
function ReviewCard({ r }) {
  return (
    <article className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] flex-none bg-origin-surface border border-origin-line-2 grid place-items-center text-origin-acc">
          <GitBranch className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={r.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display font-medium text-[16.5px] tracking-tight text-origin-ink inline-flex items-center gap-2 no-underline hover:text-origin-acc"
          >
            {r.name}
            <ExternalLink className="w-3.5 h-3.5 text-origin-ink-4" />
          </a>
          {r.commits_count > 0 && (
            <div className="font-mono text-[11.5px] text-origin-ink-4 mt-0.5">
              {r.commits_count.toLocaleString()} commits analyzed
            </div>
          )}
        </div>
      </div>

      {!r.analyzed && (
        <p className="mt-4 text-[13px] text-origin-ink-3 italic">Analysis pending — re-run profile setup to generate a review.</p>
      )}

      {r.summary && (
        <p className="mt-4 text-[14px] leading-relaxed text-origin-ink-2 text-pretty">{r.summary}</p>
      )}

      {(r.skills_detected || []).length > 0 && (
        <div className="mt-4">
          <div className="font-mono text-[10.5px] tracking-[0.13em] uppercase text-origin-ink-3 mb-2">Skills detected</div>
          <div className="flex flex-wrap gap-1.5">
            {r.skills_detected.map((s) => (
              <span key={s} className="font-mono text-[11.5px] py-1 px-2.5 rounded-md border border-[oklch(0.86_0.19_142/0.28)] bg-[oklch(0.86_0.19_142/0.1)] text-origin-acc">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {(r.languages || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.languages.map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5 font-mono text-[11px] py-1 px-2 rounded-md border border-origin-line text-origin-ink-2 bg-origin-bg">
              <i className="w-2 h-2 rounded-full" style={{ background: langColor(l) }} />
              {l}
            </span>
          ))}
        </div>
      )}

      {(r.frameworks || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.frameworks.map((f) => (
            <span key={f} className="font-mono text-[11px] py-1 px-2 rounded-md border border-origin-line text-origin-ink-3 bg-origin-bg">
              {f}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export const RepoReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/analysis/repo-reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load reviews (${res.status})`);
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (e) {
      setError(e.message || 'Could not load reviews');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    // Refresh by re-pulling GitHub data — uses the existing refresh-contributions
    // endpoint to also kick the agent to redo per-repo analysis next time
    // setup runs. For now we just re-fetch what's stored.
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-medium text-[clamp(28px,4vw,38px)] tracking-tight">
            <span className="text-origin-acc">Repo</span> Reviews
          </h1>
          <p className="mt-2 text-[15px] text-origin-ink-3 max-w-[60ch]">
            What the agent saw in each repo you connected — detected skills, languages, and a short summary.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 text-[13px] py-2 px-3.5 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-origin-ink-4">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <div className="font-mono text-xs tracking-wider uppercase">Loading reviews…</div>
        </div>
      ) : error ? (
        <div className="p-3.5 rounded-lg border border-[oklch(0.7_0.16_25/0.4)] bg-[oklch(0.7_0.16_25/0.08)] text-[oklch(0.78_0.13_30)] text-[13px]">{error}</div>
      ) : reviews.length === 0 ? (
        <div className="bg-origin-bg-soft border border-origin-line rounded-[15px] py-16 px-8 text-center">
          <div className="w-[60px] h-[60px] mx-auto mb-5 rounded-[14px] grid place-items-center bg-origin-surface border border-origin-line-2 text-origin-ink-2">
            <GitBranch className="w-7 h-7" />
          </div>
          <h2 className="font-display font-medium text-[22px] tracking-tight text-origin-ink">No reviews yet</h2>
          <p className="mt-2 text-[14px] text-origin-ink-3 max-w-[44ch] mx-auto">
            Pick repositories in profile setup and the agent will analyze each one. Their reviews show up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
          {reviews.map((r) => <ReviewCard key={r.url || r.name} r={r} />)}
        </div>
      )}
    </div>
  );
};

export default RepoReviews;
