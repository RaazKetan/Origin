import React, { useState } from 'react';
import {
  Compass, MessageSquare, Briefcase, FileText, User as UserIcon,
  Activity, Bookmark, Search, Menu, LogOut, GitBranch,
} from 'lucide-react';
import { initials as initialsOf } from '../lib/format';
// Theme toggle now mounted globally in App.jsx (fixed top-right on every page).

const OriginMark = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--color-origin-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 12 H8.6" />
    <circle cx="12" cy="12" r="3.3" />
    <path d="M15.4 12 H20.5" />
  </svg>
);


const NAV_PRIMARY = [
  { id: 'discover',     label: 'Discover',        icon: Compass },
  { id: 'jobs',         label: 'Jobs',            icon: Briefcase },
  { id: 'applications', label: 'My Applications', icon: FileText },
  { id: 'connections',  label: 'Connections',     icon: MessageSquare },
  { id: 'repoReviews',  label: 'Repo Reviews',    icon: GitBranch },
  { id: 'profile',      label: 'My Profile',      icon: UserIcon },
  // 'Find Talent' lives under a future recruiter-only flow; hidden for now.
];

/**
 * AppShell — sidebar + topbar layout used by every dashboard page.
 *
 * Props:
 *   currentView      string   - which nav item is active
 *   onNavigate       (id) =>  - called when a nav item is clicked
 *   currentUser      object   - { name, username } for the user chip
 *   onLogout         ()  =>   - optional logout handler
 *   crumb            ReactNode- mono breadcrumb e.g. "DISCOVER / Jobs"
 *   actions          ReactNode- right-aligned topbar buttons
 *   search           string?  - optional placeholder for the topbar search
 *   onSearchChange   (s) =>   - if search is provided
 *   counts           { signal, saved, messages } - optional activity counters
 *   children         page content
 */
export const AppShell = ({
  currentView,
  onNavigate,
  currentUser,
  onLogout,
  crumb,
  actions,
  search,
  searchValue = '',
  onSearchChange,
  counts = {},
  isDarkMode,
  toggleTheme,
  children,
}) => {
  const [railOpen, setRailOpen] = useState(false);

  const Rail = (
    <aside
      className={`fixed lg:sticky top-0 z-30 lg:z-auto h-screen w-[244px] border-r border-origin-line bg-origin-bg flex flex-col p-5 transition-transform duration-200 ${
        railOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* brand */}
      <div className="flex items-center gap-2.5 font-bold text-[19px] tracking-tight px-2 py-1 pb-5">
        <span className="w-[30px] h-[30px] rounded-full bg-origin-ink grid place-items-center flex-none"><OriginMark /></span>
        <span>origin</span>
      </div>

      {/* primary nav */}
      <div className="flex flex-col gap-0.5">
        {NAV_PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { setRailOpen(false); onNavigate?.(item.id); }}
              className={`flex items-center gap-3 py-2 px-2.5 rounded-[9px] text-[14.5px] font-medium tracking-tight transition-colors text-left ${
                active ? 'bg-origin-surface text-origin-ink' : 'text-origin-ink-3 hover:bg-origin-surface hover:text-origin-ink'
              } bg-transparent border-0 cursor-pointer w-full`}
            >
              <Icon className={`w-[18px] h-[18px] flex-none ${active ? 'text-origin-acc' : ''}`} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* activity group */}
      <div className="flex flex-col gap-0.5 mt-2">
        <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-origin-ink-4 pt-4 pb-2 px-2.5">Activity</div>
        {[
          { label: 'Signal',   icon: Activity,    count: counts.signal },
          { label: 'Saved',    icon: Bookmark,    count: counts.saved },
          { label: 'Messages', icon: MessageSquare, count: counts.messages },
        ].map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.label}
              type="button"
              className="flex items-center gap-3 py-2 px-2.5 rounded-[9px] text-[14.5px] font-medium tracking-tight text-origin-ink-3 hover:bg-origin-surface hover:text-origin-ink transition-colors text-left bg-transparent border-0 cursor-pointer w-full"
            >
              <Icon className="w-[18px] h-[18px] flex-none" />
              {row.label}
              {row.count != null && (
                <span className="ml-auto font-mono text-[11px] text-origin-ink-4 bg-origin-surface-2 rounded-md py-px px-2">{row.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* user chip */}
      <div className="mt-auto pt-4 border-t border-origin-line">
        <div className="flex items-center gap-2.5 p-2 rounded-[10px] hover:bg-origin-surface transition-colors cursor-pointer group" onClick={() => onNavigate?.('profile')}>
          <span className="w-[34px] h-[34px] rounded-full grid place-items-center font-display font-medium text-[13px] text-origin-ink-2 bg-gradient-to-br from-origin-surface-2 to-origin-surface border border-origin-line-2 flex-none overflow-hidden">
            {currentUser?.avatar_url ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" /> : initialsOf(currentUser?.name || currentUser?.username)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis text-origin-ink">{currentUser?.name || currentUser?.username || 'Guest'}</div>
            <div className="font-mono text-[11px] text-origin-ink-4 whitespace-nowrap overflow-hidden text-ellipsis">@{currentUser?.username || '—'}</div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onLogout(); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-origin-ink-4 hover:text-origin-ink bg-transparent border-0 cursor-pointer"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-origin-bg text-origin-ink font-[family-name:var(--font-display)] antialiased grid grid-cols-1 lg:grid-cols-[244px_minmax(0,1fr)]">
      {Rail}
      {railOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setRailOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 lg:hidden bg-transparent border-0"
        />
      )}

      {/* main column with engineering grid backdrop */}
      <div className="min-w-0 relative">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none opacity-[0.28] lg:left-[244px]"
          style={{
            backgroundImage: 'linear-gradient(var(--color-origin-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-origin-line) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 60% 0%, #000 0%, transparent 60%)',
            maskImage: 'radial-gradient(ellipse 90% 70% at 60% 0%, #000 0%, transparent 60%)',
          }}
        />

        {/* topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-4 h-16 px-5 lg:px-7 border-b border-origin-line backdrop-blur-md bg-origin-bg/80">
          <button
            type="button"
            className="lg:hidden w-9 h-9 grid place-items-center rounded-md text-origin-ink-2 bg-origin-bg-soft border border-origin-line hover:bg-origin-surface transition-colors"
            onClick={() => setRailOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
          {crumb && (
            <div className="font-mono text-xs tracking-[0.1em] uppercase text-origin-ink-4">
              {typeof crumb === 'string' ? crumb : crumb}
            </div>
          )}
          {search && (
            <div className="hidden md:flex items-center gap-2.5 bg-origin-bg-soft border border-origin-line rounded-[11px] px-3.5 h-[42px] text-origin-ink-3 focus-within:border-origin-line-2 transition-colors max-w-md flex-1">
              <Search className="w-[18px] h-[18px] text-origin-ink-4 flex-none" />
              <input
                type="text"
                placeholder={search}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-origin-ink font-[inherit] text-[14.5px] tracking-tight placeholder:text-origin-ink-4"
              />
              <span className="hidden md:inline font-mono text-[11px] text-origin-ink-4 border border-origin-line-2 rounded-[5px] py-0.5 px-1.5">⌘K</span>
            </div>
          )}
          <div className="flex-1" />
          {actions}
        </header>

        {/* content */}
        <main className="relative z-10 px-5 lg:px-7 py-7 pb-16">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
