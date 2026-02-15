import React, { useState, useEffect } from 'react';
import { 
  Building2, MapPin, DollarSign, Briefcase, 
  Clock, ChevronRight, Zap 
} from 'lucide-react';

const API_BASE = "http://localhost:8000";

const JobCard = ({ job, onClick }) => {
  // Determine match strength for UI based on score
  const score = job.final_match_score || 0;
  let matchType = 'weak';
  if (score >= 80) matchType = 'strong';
  else if (score >= 60) matchType = 'likely';

  const matchConfig = {
    strong: {
      bg: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-300',
      icon: '✨',
      label: 'Strong Match',
      description: 'Perfect alignment with your profile'
    },
    likely: {
      bg: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-800 dark:text-blue-300',
      icon: '🎯',
      label: 'Likely Match',
      description: 'Good fit for your skills'
    },
    weak: {
      bg: 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/40 dark:to-slate-800/40',
      border: 'border-gray-200 dark:border-white/5',
      text: 'text-gray-700 dark:text-zinc-400',
      icon: '💼',
      label: 'Opportunity',
      description: 'Role worth exploring'
    }
  };

  const match = matchConfig[matchType];

  return (
    <div 
      onClick={() => onClick(job)}
      className="bg-white dark:bg-[#1a1a1c] rounded-3xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Match Strength Banner */}
      <div className={`${match.bg} ${match.border} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{match.icon}</span>
            <div>
              <h3 className={`${match.text} font-semibold text-sm tracking-wide`}>
                {match.label}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                {match.description}
              </p>
            </div>
          </div>
          {score > 0 && (
            <div className="text-right">
              <div className={`${match.text} text-lg font-bold`}>
                {Math.round(score)}%
              </div>
              <div className="text-xs text-gray-400 dark:text-zinc-600">match</div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">
              {job.title}
            </h3>
            <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400 mt-1">
              <Building2 className="w-4 h-4" />
              <span className="font-medium">Company Confidential</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
            <MapPin className="w-4 h-4" />
            {job.location || 'Remote'}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
            <DollarSign className="w-4 h-4" />
            {job.salary_range || 'Competitive'}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
            <Clock className="w-4 h-4" />
            {new Date(job.created_at).toLocaleDateString()}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {(job.skills || []).slice(0, 4).map((skill, i) => (
            <span key={i} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
              {skill}
            </span>
          ))}
          {(job.skills || []).length > 4 && (
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-zinc-400 text-xs font-medium rounded-full">
              +{job.skills.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const JobDetails = ({ job, onClose, onApply }) => {
  const [coverLetter, setCoverLetter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onApply(job.id, coverLetter);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a1a1c] w-full max-w-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{job.title}</h2>
            <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company Confidential • {job.location}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400"
          >
            <span className="text-2xl leading-none">&times;</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Description
            </h3>
            <p className="text-gray-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>
          </section>

          {job.requirements && (
            <section>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                Requirements
              </h3>
              <p className="text-gray-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {job.requirements}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill, i) => (
                <span key={i} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="pt-6 border-t border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Apply for this Role</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Cover Letter (Optional)
              </label>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Briefly explain why you're a good fit..."
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[120px]"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Sending Application...' : 'Submit Application'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const Jobs = ({ isDarkMode }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/jobs/feed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      } else {
        console.error("Failed to fetch jobs");
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (jobId, coverLetter) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter })
      });

      if (res.ok) {
        alert("Application submitted successfully!");
        setSelectedJob(null);
      } else {
        const err = await res.json();
        alert(`Application failed: ${err.detail}`);
      }
    } catch (error) {
      console.error("Application error:", error);
      alert("Error submitting application");
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 pb-24 min-h-screen ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            Job Feed
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
            Curated opportunities matched to your specific skill set.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-24">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-gray-500 dark:text-zinc-500 font-medium">Finding your perfect matches...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-[#1a1a1c] rounded-3xl border border-gray-100 dark:border-white/5">
          <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No jobs found yet</h3>
          <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
            Check back later! We're constantly analyzing new roles for you.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {jobs.map(job => (
            <JobCard 
              key={job.id} 
              job={job} 
              onClick={setSelectedJob} 
            />
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetails 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)}
          onApply={handleApply}
        />
      )}
    </div>
  );
};
