import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase, Clock, MapPin, DollarSign, Building2,
  Search, Filter, CheckCircle, XCircle, MessageSquare,
  ChevronRight, BarChart3, Eye
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

const STATUS_CONFIG = {
  applied: {
    label: 'Applied', color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
    icon: <Clock className="w-3.5 h-3.5" />, step: 1
  },
  reviewed: {
    label: 'Reviewed', color: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
    icon: <Eye className="w-3.5 h-3.5" />, step: 2
  },
  interview: {
    label: 'Interview', color: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
    icon: <MessageSquare className="w-3.5 h-3.5" />, step: 3
  },
  accepted: {
    label: 'Accepted', color: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300',
    icon: <CheckCircle className="w-3.5 h-3.5" />, step: 4
  },
  rejected: {
    label: 'Rejected', color: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300',
    icon: <XCircle className="w-3.5 h-3.5" />, step: 0
  }
};

const PIPELINE_STEPS = ['Applied', 'Reviewed', 'Interview', 'Offer'];

/* ─── Pipeline bar ─────────────────────────────────────── */
const PipelineBar = ({ status }) => {
  const step = STATUS_CONFIG[status]?.step || 1;
  const isRejected = status === 'rejected';

  return (
    <div className="flex items-center gap-1 mt-3">
      {PIPELINE_STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = !isRejected && step >= stepNum;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full transition-all ${
              isRejected ? 'bg-red-200 dark:bg-red-500/20' :
              isActive ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-gray-200 dark:bg-white/5'
            }`} />
            <span className={`text-[10px] font-medium ${
              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-zinc-600'
            }`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── Application Card ─────────────────────────────────── */
const ApplicationCard = ({ app }) => {
  const statusConf = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied;

  return (
    <div className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-100 dark:border-white/5 p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{app.job_title}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>{app.employer_org_name || app.employer_name || 'Company Confidential'}</span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusConf.color}`}>
          {statusConf.icon}
          {statusConf.label}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {app.job_location && (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
            <MapPin className="w-3 h-3" /> {app.job_location}
          </span>
        )}
        {app.job_salary_range && (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
            <DollarSign className="w-3 h-3" /> {app.job_salary_range}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-full">
          <Clock className="w-3 h-3" /> Applied {new Date(app.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-1">
        {(app.job_skills || []).slice(0, 4).map((skill, i) => (
          <span key={i} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs rounded-full">
            {skill}
          </span>
        ))}
      </div>

      <PipelineBar status={app.status} />
    </div>
  );
};

/* ─── Main ApplicationsTracker ─────────────────────────── */
export const ApplicationsTracker = ({ isDarkMode }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { fetchApplications(); }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/my-applications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setApplications(await res.json());
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return applications.filter(app => {
      if (statusFilter && app.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${app.job_title} ${app.employer_name || ''} ${app.employer_org_name || ''} ${(app.job_skills || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [applications, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const counts = { total: applications.length, applied: 0, reviewed: 0, interview: 0, accepted: 0, rejected: 0 };
    applications.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
    return counts;
  }, [applications]);

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 pb-24 min-h-screen ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">My</span> Applications
        </h1>
        <p className={`text-base ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
          Track every job you've applied to and their status.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Total', count: stats.total, color: 'from-blue-500 to-indigo-500' },
          { label: 'Applied', count: stats.applied, color: 'from-blue-400 to-blue-500' },
          { label: 'Reviewed', count: stats.reviewed, color: 'from-yellow-400 to-orange-400' },
          { label: 'Interview', count: stats.interview, color: 'from-purple-400 to-purple-500' },
          { label: 'Accepted', count: stats.accepted, color: 'from-green-400 to-emerald-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-100 dark:border-white/5 p-4 text-center">
            <p className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.count}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by job title or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-3 rounded-2xl bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        >
          <option value="">All Statuses</option>
          <option value="applied">Applied</option>
          <option value="reviewed">Reviewed</option>
          <option value="interview">Interview</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-24">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-gray-500 dark:text-zinc-500 font-medium">Loading applications…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-[#1a1a1c] rounded-3xl border border-gray-100 dark:border-white/5">
          <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {search || statusFilter ? 'No matching applications' : 'No applications yet'}
          </h3>
          <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
            {search || statusFilter
              ? 'Try adjusting your search or status filter.'
              : 'Start applying to jobs from the Discover page!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(app => <ApplicationCard key={app.id} app={app} />)}
        </div>
      )}
    </div>
  );
};

export default ApplicationsTracker;
