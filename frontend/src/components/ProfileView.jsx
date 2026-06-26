import React, { useEffect, useMemo, useState } from 'react';
import {
  Pencil, Share2, MessageSquare, MapPin, ExternalLink, Github as GithubIcon, Globe,
  Star as StarIcon, GitFork, Loader2,
} from 'lucide-react';
import { GitHubCalendar } from 'react-github-calendar';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// =========================== small helpers ===========================

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U';

// "Joined N months ago" / "Joined Jun 2026". We don't say "0y active" — it's
// nonsense for any account younger than a year and reads as broken.
const joinedLabel = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 30) return 'Joined this month';
  const years = Math.floor(days / 365.25);
  if (years >= 1) return `Joined ${years}y ago`;
  const months = Math.max(1, Math.floor(days / 30));
  return `Joined ${months} month${months === 1 ? '' : 's'} ago`;
};

const repoMetaFromUrl = (url) => {
  const m = String(url || '').match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (!m) return { owner: '', name: url };
  return { owner: m[1], name: m[2] };
};

// language → color (matches the design's amber/sky/acc-2/ink-4 palette)
const langColor = (lang) => {
  const k = String(lang || '').toLowerCase();
  if (/(rust|java)/.test(k))                        return 'oklch(0.82 0.15 78)';   // amber
  if (/(type ?script|javascript|tsx|jsx)/.test(k))  return 'oklch(0.78 0.11 235)';  // sky
  if (/(python|django|flask)/.test(k))              return 'oklch(0.72 0.16 144)';  // acc-2
  if (/(go|golang)/.test(k))                        return 'oklch(0.72 0.16 144)';  // acc-2
  if (/(c\+\+|cpp|c#|csharp)/.test(k))              return 'oklch(0.78 0.11 235)';
  if (/(ruby)/.test(k))                             return 'oklch(0.7 0.18 25)';
  return 'oklch(0.48 0.01 250)';                                                    // ink-4 / other
};

// Origin design palette for the contribution heatmap.
const CALENDAR_THEME = {
  light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  dark:  ['#1f2024', '#3d6845', '#5d9466', '#80be88', '#a4e6a8'],
};

// Extract the GitHub username from the user's stored profile URL.
const githubHandleFromUrl = (url) => {
  if (!url) return null;
  const m = String(url).match(/github\.com\/([A-Za-z0-9-]+)/i);
  return m ? m[1] : null;
};

// =========================== component ===========================

export const ProfileView = ({ currentUser, onBack }) => {
  const user = currentUser || {};
  // GitHub username for the calendar (parsed from the stored profile URL).
  const githubHandle = useMemo(() => githubHandleFromUrl(user.github_profile_url), [user.github_profile_url]);
  const totalCommits = user.contributions_total; // optional — only shown if known

  // ----- derived data (real where possible, sensible fallbacks elsewhere) -----
  const score = Math.max(0, Math.min(100, Number(user.portfolio_score) || 0));
  const rank = user.portfolio_rank || (score >= 80 ? 'Expert' : score >= 60 ? 'Advanced' : score >= 35 ? 'Intermediate' : 'Beginner');
  const joinedAt = joinedLabel(user.created_at);
  const selectedRepos = Array.isArray(user.github_selected_repos) ? user.github_selected_repos : [];
  const verified = score >= 70;

  // ----- matched roles (best-effort) -----
  const [matched, setMatched] = useState([]);
  const [loadingMatched, setLoadingMatched] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoadingMatched(false); return; }
    fetch(`${API_BASE}/jobs/feed?limit=3`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setMatched(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setLoadingMatched(false));
  }, []);

  // ----- pinned projects: ONLY real data from the user's selected repos.
  // No fabricated "impact" number; show stars / forks / language when present.
  const pinnedProjects = useMemo(() => {
    return selectedRepos.slice(0, 5).map((r) => {
      const { owner, name } = repoMetaFromUrl(r.url || r.repo_url || '');
      return {
        url: r.url || r.repo_url || '#',
        owner,
        name: r.name || name || 'repository',
        description: r.description || r.summary || null,
        stars: r.stars ?? r.stargazers_count ?? null,
        forks: r.forks ?? r.forks_count ?? null,
        language: r.language || null,
      };
    });
  }, [selectedRepos]);

  // ----- skills: just the user's actual list, no fabricated confidence numbers.
  // We don't have per-skill confidence — pretending we do is misleading.
  const skills = (user.skills || []).slice(0, 12);

  // ----- top languages: show whatever was detected, no fake percentages.
  const languages = (user.top_languages || []).slice(0, 6);

  // ----- links -----
  const links = useMemo(() => {
    const out = [];
    if (user.github_profile_url) {
      const handle = user.github_profile_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      out.push({ kind: 'github', label: handle, href: user.github_profile_url });
    }
    if (user.org_name && user.org_type === 'company') {
      out.push({ kind: 'web', label: user.org_name, href: '#' });
    }
    return out;
  }, [user.github_profile_url, user.org_name, user.org_type]);

  // ponytail: only show stats we actually compute. Placeholder "—" and "0"
  // tiles read as broken; hide until the data exists.
  const stats = [
    totalCommits != null && { n: totalCommits.toLocaleString(), l: 'Commits / 12mo' },
    selectedRepos.length && { n: selectedRepos.length, l: 'Repositories' },
    matched.length && { n: matched.length, l: 'Matched roles' },
  ].filter(Boolean);

  // =========================== render ===========================

  return (
    <div className="origin-grid min-h-screen bg-origin-bg text-origin-ink font-[family-name:var(--font-display)] antialiased">
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 py-7 pb-20">
        {/* Topbar / breadcrumb */}
        <header className="flex items-center gap-4 mb-5">
          <button onClick={onBack} className="font-mono text-xs tracking-[0.1em] uppercase text-origin-ink-4 hover:text-origin-ink-2 bg-transparent border-0 cursor-pointer p-0">
            ← Discover
          </button>
          <div className="font-mono text-xs tracking-[0.1em] uppercase text-origin-ink-4">PROFILE / <b className="text-origin-ink font-medium normal-case tracking-tight">{user.name || user.username || '—'}</b></div>
          <div className="flex-1" />
          <button className="hidden sm:inline-flex items-center gap-2 text-[13px] py-1.5 px-3 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button className="inline-flex items-center gap-2 text-[13px] py-1.5 px-3 rounded-md bg-origin-acc text-origin-acc-ink hover:bg-[oklch(0.9_0.19_142)] hover:-translate-y-px hover:shadow-[0_8px_24px_oklch(0.86_0.19_142/0.22)] transition-all">
            <Pencil className="w-3.5 h-3.5" />
            Edit profile
          </button>
        </header>

        {/* HERO CARD */}
        <section className="bg-origin-bg-soft border border-origin-line rounded-[15px]">
          <div className="grid grid-cols-[auto_1fr_auto] gap-5 items-center p-6 max-md:grid-cols-1 max-md:gap-5">
            {/* avatar */}
            <span className="w-[84px] h-[84px] rounded-full grid place-items-center font-display font-medium text-[30px] text-origin-ink-2 bg-gradient-to-br from-origin-surface-2 to-origin-surface border border-origin-line-2 flex-none overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : initials(user.name || user.username)}
            </span>

            {/* who */}
            <div className="min-w-0">
              <div className="font-display font-medium text-[26px] tracking-tight flex items-center gap-2.5 flex-wrap">
                {user.name || user.username || 'Unknown'}
                {verified && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold tracking-wider uppercase text-origin-acc bg-[oklch(0.86_0.19_142/0.12)] border border-[oklch(0.86_0.19_142/0.25)] rounded-md py-[3px] px-1.5">
                    ✓ VERIFIED
                  </span>
                )}
              </div>
              <div className="font-mono text-[13px] text-origin-ink-3 mt-1">
                @{user.username || 'user'}{joinedAt && <> · {joinedAt}</>}
              </div>
              {user.bio && <p className="mt-2.5 text-[15px] leading-relaxed text-origin-ink-2 max-w-[54ch] text-pretty">{user.bio}</p>}
              <div className="mt-3.5 flex items-center gap-3.5 flex-wrap text-[13.5px] text-origin-ink-3">
                {user.org_name && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-origin-ink-4" />
                    {user.org_name}{user.org_type ? ` · ${user.org_type}` : ''}
                  </span>
                )}
                {user.org_name && <span className="w-[3px] h-[3px] rounded-full bg-origin-ink-4" />}
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-origin-acc shadow-[0_0_8px_var(--color-origin-acc)]" />
                  Open to senior roles
                </span>
                {user.activity_score != null && (
                  <>
                    <span className="w-[3px] h-[3px] rounded-full bg-origin-ink-4" />
                    <span className="inline-flex items-center gap-1.5 font-mono">Activity {user.activity_score}/100</span>
                  </>
                )}
              </div>
            </div>

            {/* right: score ring + message */}
            <div className="flex flex-col items-end gap-3.5 max-md:flex-row max-md:items-center max-md:justify-between max-md:w-full">
              <div className="text-center">
                <div className="origin-score-ring w-[92px] h-[92px] relative grid place-items-center rounded-full" style={{ '--p': score }}>
                  <span className="relative z-10 font-mono font-semibold text-[26px] tracking-tight text-origin-ink">
                    {score}<s className="font-mono text-xs text-origin-ink-4 no-underline">/100</s>
                  </span>
                </div>
                <div className="font-mono text-[10px] tracking-widest uppercase text-origin-ink-4 mt-1.5 text-center">Signal score</div>
              </div>
              <div className="flex gap-2.5">
                <button className="inline-flex items-center gap-2 text-[13px] py-1.5 px-3 rounded-md bg-origin-bg-soft text-origin-ink border border-origin-line-2 hover:bg-origin-surface hover:border-origin-ink-4 transition-all">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Message
                </button>
              </div>
            </div>
          </div>

          {/* stats row */}
          <div className="grid grid-cols-4 border-t border-origin-line max-sm:grid-cols-2">
            {stats.map((s, i) => (
              <div
                key={s.l}
                className={`py-4 px-6 ${i > 0 ? 'border-l border-origin-line' : ''} max-sm:[&:nth-child(3)]:border-l-0 max-sm:[&:nth-child(n+3)]:border-t max-sm:[&:nth-child(n+3)]:border-origin-line`}
              >
                <div className="font-display font-medium text-[22px] tracking-tight">{s.n}</div>
                <div className="font-mono text-[10.5px] tracking-widest uppercase text-origin-ink-4 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* MAIN GRID */}
        <div className="grid gap-5 mt-5 grid-cols-[minmax(0,1fr)_320px] items-start max-[1080px]:grid-cols-1">
          {/* LEFT */}
          <div className="flex flex-col gap-5">
            {/* Contribution heatmap — react-github-calendar fetches public
                contributions for the user's GitHub handle. No server token,
                no fake data: if the user hasn't linked GitHub, we hide it. */}
            {githubHandle && (
              <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
                <CardHead
                  title="Verified contribution history"
                  meta={totalCommits != null ? `${totalCommits.toLocaleString()} commits · last 12 months` : 'from GitHub'}
                />
                <div className="overflow-x-auto">
                  <GitHubCalendar
                    username={githubHandle}
                    colorScheme="dark"
                    theme={CALENDAR_THEME}
                    blockSize={11}
                    blockMargin={3}
                    fontSize={11}
                    hideTotalCount
                    labels={{ totalCount: '{{count}} contributions in the last year' }}
                    errorMessage="Couldn't load GitHub activity. Make sure the username is correct."
                  />
                </div>
              </section>
            )}

            {/* pinned projects — real GitHub data only */}
            <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
              <CardHead title="Pinned projects" meta={pinnedProjects.length ? `${pinnedProjects.length} selected` : null} />
              {pinnedProjects.length === 0 ? (
                <EmptyHint>Add repositories from your profile setup to see them here.</EmptyHint>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {pinnedProjects.map((r) => (
                    <a
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 border border-origin-line rounded-xl bg-origin-bg hover:border-origin-line-2 hover:bg-origin-surface transition-all no-underline text-origin-ink"
                    >
                      <div className="font-display font-medium text-[15px] tracking-tight flex items-center gap-2 flex-wrap">
                        {r.name}
                        {r.owner.toLowerCase() === (user.username || '').toLowerCase() && (
                          <span className="inline-flex items-center font-mono text-[10.5px] font-semibold tracking-wider uppercase text-origin-acc bg-[oklch(0.86_0.19_142/0.12)] border border-[oklch(0.86_0.19_142/0.25)] rounded-md py-[3px] px-1.5">
                            ✓ OWNER
                          </span>
                        )}
                      </div>
                      {r.description && <div className="mt-1.5 text-[13px] leading-snug text-origin-ink-3 text-pretty line-clamp-2">{r.description}</div>}
                      <div className="mt-3 flex items-center gap-3.5 font-mono text-[11.5px] text-origin-ink-4 flex-wrap">
                        {r.language && (
                          <span className="inline-flex items-center gap-1.5 text-origin-ink-3">
                            <i className="w-2 h-2 rounded-full" style={{ background: langColor(r.language) }} />
                            {r.language}
                          </span>
                        )}
                        {r.stars != null && <span className="inline-flex items-center gap-1"><StarIcon className="w-3 h-3" /> {r.stars}</span>}
                        {r.forks != null && <span className="inline-flex items-center gap-1"><GitFork className="w-3 h-3" /> {r.forks}</span>}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {/* experience — only render if we have any data; we don't have a backend field yet */}
            {user.org_name && (
              <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
                <CardHead title="Experience" />
                <div className="flex gap-3.5 py-3.5">
                  <div className="w-10 h-10 rounded-[9px] flex-none bg-origin-surface border border-origin-line-2 grid place-items-center font-display font-semibold text-[15px] text-origin-ink-2">
                    {initials(user.org_name)}
                  </div>
                  <div>
                    <div className="font-display font-medium text-[14.5px] tracking-tight">{user.name || 'Member'}</div>
                    <div className="text-[13px] text-origin-ink-3 mt-0.5">{user.org_name}{user.org_type ? ` · ${user.org_type}` : ''}</div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-5">
            {/* skills — real list, no fabricated confidence numbers */}
            <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
              <CardHead title="Skills" meta={skills.length ? `${skills.length} added` : null} />
              {skills.length === 0 ? (
                <EmptyHint>Add skills during profile setup.</EmptyHint>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="font-mono text-[11.5px] py-1 px-2.5 rounded-md border border-origin-line text-origin-ink-2 bg-origin-bg">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* languages — chips only, no fake percentages until we have real ratios */}
            {languages.length > 0 && (
              <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
                <CardHead title="Languages" meta="from your repos" />
                <div className="flex flex-wrap gap-1.5">
                  {languages.map((l) => (
                    <span key={l} className="inline-flex items-center gap-1.5 font-mono text-[11.5px] py-1 px-2.5 rounded-md border border-origin-line text-origin-ink-2 bg-origin-bg">
                      <i className="w-2 h-2 rounded-full" style={{ background: langColor(l) }} />
                      {l}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* matched roles */}
            <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
              <CardHead title="Matched roles" meta="this week" />
              {loadingMatched ? (
                <div className="flex items-center gap-2 text-origin-ink-4 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : matched.length === 0 ? (
                <EmptyHint>No matches yet — your score is still warming up.</EmptyHint>
              ) : (
                <div className="flex flex-col">
                  {matched.slice(0, 5).map((m, i) => {
                    const companyName = m.employer_org_name || m.employer_name || 'Company';
                    return (
                      <a key={m.id || i} href="#" className={`flex items-center gap-3 py-3 no-underline text-origin-ink ${i > 0 ? 'border-t border-origin-line' : ''}`}>
                        <span className="w-9 h-9 rounded-lg flex-none bg-origin-surface border border-origin-line-2 grid place-items-center font-display font-semibold text-[13px] text-origin-ink-2">
                          {initials(companyName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-medium tracking-tight truncate">{m.title || 'Role'}</div>
                          <div className="font-mono text-[11px] text-origin-ink-4 mt-0.5 truncate">{companyName}{m.location ? ` · ${m.location}` : ''}</div>
                        </div>
                        <span className="ml-auto font-mono font-semibold text-[13px] text-origin-acc">
                          {Math.round(m.final_match_score ?? m.visibility_score ?? 90)}%
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </section>

            {/* links */}
            {links.length > 0 && (
              <section className="bg-origin-bg-soft border border-origin-line rounded-[15px] p-5">
                <CardHead title="Links" />
                <div className="flex flex-col gap-0.5">
                  {links.map((l) => (
                    <a
                      key={l.href + l.label}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-lg text-origin-ink-2 text-[13.5px] hover:bg-origin-surface hover:text-origin-ink transition-all no-underline"
                    >
                      {l.kind === 'github' ? <GithubIcon className="w-4 h-4 text-origin-ink-4 flex-none" /> : <Globe className="w-4 h-4 text-origin-ink-4 flex-none" />}
                      <span className="truncate">{l.label}</span>
                      <span className="ml-auto text-origin-ink-4"><ExternalLink className="w-3.5 h-3.5" /></span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================== sub-components ===========================

function CardHead({ title, meta }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[11px] tracking-[0.13em] uppercase text-origin-ink-3">{title}</span>
      {meta && <span className="ml-auto font-mono text-[11px] text-origin-ink-4">{meta}</span>}
    </div>
  );
}

function EmptyHint({ children }) {
  return <div className="text-[13px] text-origin-ink-4 leading-snug">{children}</div>;
}

export default ProfileView;
