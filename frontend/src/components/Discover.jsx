import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, MapPin, DollarSign, Briefcase, Clock, ChevronRight,
  Filter, X, Building2, Zap, SlidersHorizontal
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

/* ─── Discover Filter Bar ──────────────────────────────── */
const FilterBar = ({ filters, setFilters, allSkills, allLocations }) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4">
      {/* Search + Toggle */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs by title, skill, or keyword…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-2xl border transition-all flex items-center gap-2 font-medium text-sm ${
            showFilters
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white dark:bg-[#1a1a1c] border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-400 hover:border-blue-500/50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Expandable Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-200 dark:border-white/10 p-5 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
          {/* Match Strength */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500 mb-2">
              Match Strength
            </label>
            <select
              value={filters.matchStrength}
              onChange={e => setFilters(f => ({ ...f, matchStrength: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All</option>
              <option value="strong">Strong (80%+)</option>
              <option value="likely">Likely (60-79%)</option>
              <option value="weak">Exploring (&lt;60%)</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500 mb-2">
              Location
            </label>
            <select
              value={filters.location}
              onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Locations</option>
              {allLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Salary */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500 mb-2">
              Salary Range
            </label>
            <select
              value={filters.salary}
              onChange={e => setFilters(f => ({ ...f, salary: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Any Salary</option>
              <option value="0-50k">$0 – $50K</option>
              <option value="50k-100k">$50K – $100K</option>
              <option value="100k-150k">$100K – $150K</option>
              <option value="150k+">$150K+</option>
            </select>
          </div>

          {/* Active filter pills */}
          {(filters.matchStrength || filters.location || filters.salary) && (
            <div className="col-span-full flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-400 dark:text-zinc-500">Active:</span>
              {filters.matchStrength && (
                <button onClick={() => setFilters(f => ({ ...f, matchStrength: '' }))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  {filters.matchStrength} <X className="w-3 h-3" />
                </button>
              )}
              {filters.location && (
                <button onClick={() => setFilters(f => ({ ...f, location: '' }))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  {filters.location} <X className="w-3 h-3" />
                </button>
              )}
              {filters.salary && (
                <button onClick={() => setFilters(f => ({ ...f, salary: '' }))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                  {filters.salary} <X className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => setFilters(f => ({ ...f, matchStrength: '', location: '', salary: '' }))}
                className="text-xs text-red-400 hover:text-red-500 ml-1">Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Job Discover Card ────────────────────────────────── */
const JobDiscoverCard = ({ job, onClick }) => {
  const score = job.final_match_score || 0;
  let matchType = 'weak';
  if (score >= 80) matchType = 'strong';
  else if (score >= 60) matchType = 'likely';

  const matchConfig = {
    strong: {
      bg: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-300',
      icon: '✨', label: 'Strong Match'
    },
    likely: {
      bg: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-300',
      icon: '🎯', label: 'Likely Match'
    },
    weak: {
      bg: 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/40 dark:to-slate-800/40',
      border: 'border-gray-200 dark:border-white/5',
      text: 'text-gray-700 dark:text-zinc-400',
      icon: '💼', label: 'Opportunity'
    }
  };
  const match = matchConfig[matchType];

  return (
    <div
      onClick={() => onClick(job)}
      className="bg-white dark:bg-[#1a1a1c] rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      {/* Match Banner */}
      <div className={`${match.bg} ${match.border} border-b px-5 py-3.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{match.icon}</span>
            <span className={`${match.text} font-semibold text-sm tracking-wide`}>{match.label}</span>
          </div>
          {score > 0 && (
            <div className={`${match.text} text-lg font-bold`}>
              {Math.round(score)}%
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors mb-1">
          {job.title}
        </h3>
        <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 text-sm mb-4">
          <Building2 className="w-3.5 h-3.5" />
          <span>Company Confidential</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 rounded-full">
            <MapPin className="w-3.5 h-3.5" /> {job.location || 'Remote'}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 rounded-full">
            <DollarSign className="w-3.5 h-3.5" /> {job.salary_range || 'Competitive'}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1.5 rounded-full">
            <Clock className="w-3.5 h-3.5" /> {new Date(job.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(job.skills || []).slice(0, 4).map((skill, i) => (
            <span key={i} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
              {skill}
            </span>
          ))}
          {(job.skills || []).length > 4 && (
            <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-zinc-400 text-xs font-medium rounded-full">
              +{job.skills.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Job Details Modal ────────────────────────────────── */
const JobDetailsModal = ({ job, onClose, onApply }) => {
  const [coverLetter, setCoverLetter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onApply(job.id, coverLetter);
    setIsSubmitting(false);
    if (success) setApplied(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1c] w-full max-w-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{job.title}</h2>
            <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4" /> Company Confidential • {job.location || 'Remote'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section>
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Description</h3>
            <p className="text-gray-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">{job.description}</p>
          </section>

          {job.requirements && (
            <section>
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Requirements</h3>
              <p className="text-gray-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap text-sm">{job.requirements}</p>
            </section>
          )}

          <section>
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {(job.skills || []).map((skill, i) => (
                <span key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <div className="flex gap-4 text-sm">
            <div className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <span className="text-gray-400 dark:text-zinc-500 text-xs uppercase tracking-wider">Salary</span>
              <p className="text-gray-900 dark:text-white font-semibold mt-1">{job.salary_range || 'Competitive'}</p>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <span className="text-gray-400 dark:text-zinc-500 text-xs uppercase tracking-wider">Location</span>
              <p className="text-gray-900 dark:text-white font-semibold mt-1">{job.location || 'Remote'}</p>
            </div>
          </div>

          {/* Apply Form */}
          {applied ? (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-6 text-center">
              <span className="text-3xl mb-2 block">🎉</span>
              <h4 className="text-green-800 dark:text-green-300 font-bold text-lg">Application Submitted!</h4>
              <p className="text-green-600 dark:text-green-400 text-sm mt-1">You'll be notified when the recruiter responds.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pt-4 border-t border-gray-100 dark:border-white/5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">Apply for this Role</h3>
              <textarea
                value={coverLetter}
                onChange={e => setCoverLetter(e.target.value)}
                placeholder="Briefly explain why you're a good fit…"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[100px] text-sm"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Sending…' : 'Submit Application'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Main Discover Component ──────────────────────────── */
export const Discover = ({ isDarkMode }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    matchStrength: '',
    location: '',
    salary: ''
  });

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/feed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setJobs(await res.json());
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId, coverLetter) => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter })
      });
      if (res.ok) return true;
      const err = await res.json();
      alert(`Application failed: ${err.detail}`);
      return false;
    } catch (error) {
      console.error('Application error:', error);
      alert('Error submitting application');
      return false;
    }
  };

  /* Derived unique values for filter dropdowns */
  const allLocations = useMemo(() => {
    return [...new Set(jobs.map(j => j.location).filter(Boolean))];
  }, [jobs]);

  const allSkills = useMemo(() => {
    return [...new Set(jobs.flatMap(j => j.skills || []))];
  }, [jobs]);

  /* Client-side filtering */
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Text search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${job.title} ${job.description || ''} ${(job.skills || []).join(' ')} ${job.location || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Match strength
      if (filters.matchStrength) {
        const score = job.final_match_score || 0;
        if (filters.matchStrength === 'strong' && score < 80) return false;
        if (filters.matchStrength === 'likely' && (score < 60 || score >= 80)) return false;
        if (filters.matchStrength === 'weak' && score >= 60) return false;
      }
      // Location
      if (filters.location && (job.location || '') !== filters.location) return false;
      return true;
    });
  }, [jobs, filters]);

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 pb-24 min-h-screen ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Discover</span> Jobs
        </h1>
        <p className={`text-base ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
          Curated opportunities matched to your skill set. Search, filter, and apply.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          allSkills={allSkills}
          allLocations={allLocations}
        />
      </div>

      {/* Results count */}
      {!loading && (
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500 dark:text-zinc-500">
            Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredJobs.length}</span> {filteredJobs.length === 1 ? 'job' : 'jobs'}
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-24">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-gray-500 dark:text-zinc-500 font-medium">Finding your perfect matches…</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-[#1a1a1c] rounded-3xl border border-gray-100 dark:border-white/5">
          <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {filters.search || filters.matchStrength || filters.location || filters.salary
              ? 'No jobs match your filters'
              : 'No jobs found yet'}
          </h3>
          <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
            {filters.search || filters.matchStrength || filters.location || filters.salary
              ? 'Try adjusting your search or filters.'
              : "Check back later! We're constantly analyzing new roles for you."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredJobs.map(job => (
            <JobDiscoverCard key={job.id} job={job} onClick={setSelectedJob} />
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={handleApply}
        />
      )}
    </div>
  );
};

export default Discover;
