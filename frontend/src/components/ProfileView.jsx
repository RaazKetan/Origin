import React, { useState, useEffect } from 'react';
import { Mail, Github, Globe, MapPin, Award, BookOpen, Layers, Code, Briefcase, Plus, X, Trash2, Calendar, GitCommit, Zap, Loader2, CheckCircle } from 'lucide-react';

export const ProfileView = ({ currentUser, onBack, onEdit, isDarkMode = true }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [user, setUser] = useState(currentUser);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  
  // Pending skills overlay state
  const [showPendingSkillsOverlay, setShowPendingSkillsOverlay] = useState(false);
  const [pendingSkills, setPendingSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState(new Set());
  const [loadingPendingSkills, setLoadingPendingSkills] = useState(false);

  // Check for pending skills on mount
  useEffect(() => {
    if (currentUser?.analysis_notification) {
      fetchPendingSkills();
    }
  }, [currentUser]);

  const fetchPendingSkills = async () => {
    setLoadingPendingSkills(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/analysis/pending-skills`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingSkills(data.skills || []);
        if (data.skills && data.skills.length > 0) {
          setShowPendingSkillsOverlay(true);
          // Pre-select all skills
          setSelectedSkills(new Set(data.skills.map(s => s.skill)));
        }
      }
    } catch (err) {
      console.error('Error fetching pending skills:', err);
    } finally {
      setLoadingPendingSkills(false);
    }
  };

  const toggleSkillSelection = (skill) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skill)) {
      newSelected.delete(skill);
    } else {
      newSelected.add(skill);
    }
    setSelectedSkills(newSelected);
  };

  const handleAcceptSkills = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/analysis/accept-skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          accepted_skills: Array.from(selectedSkills)
        })
      });

      if (response.ok) {
        // Refresh user data
        const updatedUser = { ...user, analysis_notification: false };
        setUser(updatedUser);
        setShowPendingSkillsOverlay(false);
        setSuccessMessage(`Successfully added ${selectedSkills.size} skills to your profile!`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error accepting skills:', err);
      setError('Failed to accept skills');
    }
  };

  const handleDismissAnalysis = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/analysis/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const updatedUser = { ...user, analysis_notification: false };
      setUser(updatedUser);
      setShowPendingSkillsOverlay(false);
    } catch (err) {
      console.error('Error dismissing analysis:', err);
    }
  };

  const handleAnalyzeRepo = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    if (!repoUrl.includes('github.com')) {
      setError('Please enter a valid GitHub URL');
      return;
    }

    setAnalyzing(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      
      const analyzeResponse = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/analyze-repo/user-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repo_url: repoUrl })
      });

      if (!analyzeResponse.ok) {
        throw new Error('Failed to analyze repository');
      }

      const analysisData = await analyzeResponse.json();
      setAnalysisData(analysisData);
      setShowAnalysisModal(true);
      setRepoUrl('');
      setError('');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to analyze repository');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmAddRepo = async () => {
    if (!analysisData) return;

    try {
      const token = localStorage.getItem('token');
      
      const addResponse = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/users/${user.id}/repositories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repo_data: analysisData })
      });

      if (!addResponse.ok) {
        const errorData = await addResponse.json();
        throw new Error(errorData.detail || 'Failed to add repository');
      }

      const updatedUser = await addResponse.json();
      setUser(updatedUser);
      setShowAnalysisModal(false);
      setAnalysisData(null);
      setSuccessMessage('Repository added successfully!');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to add repository');
      setShowAnalysisModal(false);
    }
  };

  const handleRemoveRepo = async (index) => {
    if (!confirm('Are you sure you want to remove this repository?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:8000'}/users/${user.id}/repositories/${index}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove repository');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to remove repository');
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
    isDarkMode 
      ? 'bg-zinc-800/50 border-white/10 text-white placeholder-zinc-500' 
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
  }`;

  const cardClass = `rounded-3xl p-8 border backdrop-blur-xl ${
    isDarkMode 
      ? 'bg-[#18181b]/60 border-white/10' 
      : 'bg-white border-gray-100 shadow-sm'
  }`;

  return (
  <div className={`w-full max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl mt-6 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
    {/* Header Section */}
    <div className={`relative px-8 py-12 ${
       isDarkMode 
          ? 'bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-pink-900/40 border-b border-white/10' 
          : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
    }`}>
      {/* Abstract Shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-6">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-xl border-4 ${
             isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-white/20 text-indigo-600'
          }`}>
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              (user.name?.charAt(0) || 'U')
            )}
          </div>
          <div>
            <h1 className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-white'}`}>{user.name}</h1>
            <p className={`text-lg font-medium opacity-80 ${isDarkMode ? 'text-zinc-300' : 'text-indigo-100'}`}>@{user.username}</p>
            <div className="flex flex-wrap gap-4 mt-3 justify-center md:justify-start">
               {user.email && (
                  <span className={`flex items-center gap-1.5 text-sm ${isDarkMode ? 'text-zinc-400' : 'text-indigo-100'}`}>
                     <Mail className="w-4 h-4" /> {user.email}
                  </span>
               )}
               {user.org_name && (
                  <span className={`flex items-center gap-1.5 text-sm ${isDarkMode ? 'text-zinc-400' : 'text-indigo-100'}`}>
                     <Briefcase className="w-4 h-4" /> {user.org_name}
                  </span>
               )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onEdit}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all backdrop-blur-md ${
               isDarkMode 
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10' 
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={onBack}
            className={`px-6 py-2.5 rounded-xl font-medium transition-all backdrop-blur-md ${
               isDarkMode 
                  ? 'bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-white/5' 
                  : 'bg-black/20 hover:bg-black/30 text-white'
            }`}
          >
            Back
          </button>
        </div>
      </div>
    </div>

    {/* Content Section */}
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Bio Section */}
          <div className={cardClass}>
            <h3 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              <BookOpen className="w-5 h-5 text-blue-500" />
              About Me
            </h3>
            <p className={`leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-gray-700'}`}>
              {user.bio || "No bio available. Click 'Edit Profile' to add your bio."}
            </p>
          </div>

          {/* Skills Section */}
          <div className={cardClass}>
             <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
               <Award className="w-5 h-5 text-purple-500" />
               Skills & Expertise
             </h3>
             <div className="flex flex-wrap gap-2">
               {(user.skills || []).map((skill, i) => (
                 <span
                   key={i}
                   className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                      isDarkMode 
                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' 
                        : 'bg-purple-50 border-purple-100 text-purple-700'
                   }`}
                 >
                   {skill}
                 </span>
               ))}
               {(user.skills || []).length === 0 && (
                  <span className={`italic ${isDarkMode ? 'text-zinc-600' : 'text-gray-400'}`}>No skills listed</span>
               )}
             </div>
          </div>

          {/* Technologies Section */}
          <div className={cardClass}>
             <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
               <Layers className="w-5 h-5 text-indigo-500" />
               Technologies
             </h3>
             
             <div className="grid md:grid-cols-2 gap-6">
               {(user.top_languages && user.top_languages.length > 0) && (
                 <div>
                   <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Languages</h4>
                   <div className="flex flex-wrap gap-2">
                     {user.top_languages.map((lang, i) => (
                       <span key={i} className={`px-3 py-1.5 rounded-lg text-sm border ${
                          isDarkMode 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : 'bg-green-50 border-green-100 text-green-700'
                       }`}>
                         {lang}
                       </span>
                     ))}
                   </div>
                 </div>
               )}
               
               {(user.top_frameworks && user.top_frameworks.length > 0) && (
                 <div>
                    <h4 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Frameworks</h4>
                    <div className="flex flex-wrap gap-2">
                     {user.top_frameworks.map((fw, i) => (
                       <span key={i} className={`px-3 py-1.5 rounded-lg text-sm border ${
                          isDarkMode 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                            : 'bg-blue-50 border-blue-100 text-blue-700'
                       }`}>
                         {fw}
                       </span>
                     ))}
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity Score */}
          {user.activity_score && (
            <div className={`rounded-3xl p-6 border ${
               isDarkMode 
                  ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/20' 
                  : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            }`}>
              <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <Zap className="w-5 h-5 text-green-500" />
                Activity Level
              </h3>
              <div className="flex items-center mb-2">
                <div className={`flex-1 rounded-full h-2 mr-3 ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
                    style={{ width: `${user.activity_score}%` }}
                  ></div>
                </div>
                <span className="text-green-500 font-bold">{user.activity_score}%</span>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                {user.activity_score > 80 ? "🔥 Very Active" : 
                 user.activity_score > 60 ? "⚡ Active" : 
                 user.activity_score > 40 ? "🌱 Moderately Active" : "💤 Getting Started"}
              </p>
            </div>
          )}

          {/* GitHub Repositories Management */}
          <div className={cardClass}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              <Github className="w-5 h-5" />
              Repositories
            </h3>
            
            {/* Add Repository Form */}
            <div className="mb-6">
              <div className="flex gap-2">
                 <input
                   type="url"
                   className={`flex-1 px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      isDarkMode 
                         ? 'bg-zinc-900/50 border-white/10 text-white placeholder-zinc-600' 
                         : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                   }`}
                   placeholder="github.com/user/repo"
                   value={repoUrl}
                   onChange={(e) => setRepoUrl(e.target.value)}
                   disabled={analyzing}
                 />
                 <button
                   onClick={handleAnalyzeRepo}
                   disabled={analyzing || !repoUrl.trim()}
                   className={`px-3 py-2 rounded-lg transition-colors ${
                      isDarkMode
                         ? 'bg-white text-black hover:bg-zinc-200 disabled:opacity-50'
                         : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
                   }`}
                 >
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                 </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              {successMessage && <p className="text-green-500 text-xs mt-2">{successMessage}</p>}
            </div>

            {/* Repository List */}
            {Array.isArray(user.github_selected_repos) && user.github_selected_repos.length > 0 ? (
              <div className="space-y-3">
                {user.github_selected_repos.map((repo, i) => (
                  <div key={i} className={`rounded-xl p-3 border transition-colors group ${
                     isDarkMode 
                        ? 'bg-zinc-900/30 border-white/5 hover:bg-zinc-900/50' 
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <a href={repo.url} target="_blank" rel="noreferrer" className={`font-medium text-sm truncate hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                        {repo.name || repo.url}
                      </a>
                      <button onClick={() => handleRemoveRepo(i)} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-2">
                      {repo.languages?.slice(0,3).map((lang, idx) => (
                        <span key={idx} className={`px-1.5 py-0.5 text-[10px] rounded border ${
                           isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-400' : 'bg-white border-gray-200 text-gray-500'
                        }`}>
                          {lang}
                        </span>
                      ))}
                    </div>
                    
                    {repo.last_analyzed && (
                       <div className={`flex items-center gap-1 text-[10px] ${isDarkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(repo.last_analyzed).toLocaleDateString()}</span>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-8 rounded-xl border border-dashed text-sm ${
                 isDarkMode ? 'border-zinc-800 text-zinc-600' : 'border-gray-200 text-gray-400'
              }`}>
                 <GitCommit className="w-8 h-8 mx-auto mb-2 opacity-30" />
                 No repositories connected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Repository Analysis Modal */}
    {showAnalysisModal && analysisData && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${
           isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-gray-200'
        }`}>
          {/* Modal Header */}
          <div className={`px-8 py-6 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
             <h3 className={`text-2xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <Code className="w-6 h-6 text-indigo-500" />
                Repository Analysis
             </h3>
             <button onClick={() => { setShowAnalysisModal(false); setAnalysisData(null); }} className={`p-2 rounded-full hover:bg-white/10 ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                <X className="w-6 h-6" />
             </button>
          </div>

          <div className="p-8 space-y-8">
            {/* Repo Details */}
             <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                   <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{analysisData.name}</h4>
                   <a href={analysisData.url} target="_blank" className="text-sm text-blue-500 hover:underline">{analysisData.url}</a>
                </div>
                <div className="flex gap-4 text-sm">
                   <span className={isDarkMode ? 'text-zinc-400' : 'text-gray-600'}>{analysisData.commits_count} commits</span>
                   <span className={isDarkMode ? 'text-zinc-400' : 'text-gray-600'}>{analysisData.contributions} contribution type</span>
                </div>
             </div>

             {/* AI Summary */}
             <div>
                <h4 className={`text-sm font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Analysis Summary</h4>
                <p className={`leading-relaxed ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>{analysisData.analysis_summary}</p>
             </div>

             {/* Detected Skills */}
             <div>
                <h4 className={`text-sm font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Skills Detected</h4>
                <div className="flex flex-wrap gap-2">
                   {analysisData.skills_detected?.map((skill, i) => (
                      <span key={i} className={`px-3 py-1 rounded-lg text-sm border ${
                         isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                      }`}>
                         {skill}
                      </span>
                   ))}
                </div>
             </div>
          </div>

          <div className={`px-8 py-6 border-t flex justify-end gap-3 ${isDarkMode ? 'border-white/5 bg-zinc-900/50' : 'border-gray-100 bg-gray-50'}`}>
             <button onClick={() => { setShowAnalysisModal(false); setAnalysisData(null); }} className={`px-6 py-2 rounded-xl font-medium ${isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                Cancel
             </button>
             <button onClick={handleConfirmAddRepo} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-500/20">
                Confirm & Add
             </button>
          </div>
        </div>
      </div>
    )}

    {/* Pending Skills Overlay */}
    {showPendingSkillsOverlay && pendingSkills.length > 0 && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border ${
          isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-gray-200'
        }`}>
          {/* Header */}
          <div className={`px-8 py-6 flex items-center justify-between border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
            <div>
              <h3 className={`text-2xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <CheckCircle className="w-6 h-6 text-green-500" />
                Repository Analysis Complete!
              </h3>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                We found {pendingSkills.length} skills from your repositories. Select which ones to add to your profile.
              </p>
            </div>
            <button 
              onClick={handleDismissAnalysis} 
              className={`p-2 rounded-full hover:bg-white/10 ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Skills by Repository */}
          <div className="p-8 space-y-6">
            {/* Group skills by repository */}
            {(() => {
              const skillsByRepo = {};
              pendingSkills.forEach(({ skill, repo_name, repo_url }) => {
                if (!skillsByRepo[repo_name]) {
                  skillsByRepo[repo_name] = { url: repo_url, skills: [] };
                }
                skillsByRepo[repo_name].skills.push(skill);
              });

              return Object.entries(skillsByRepo).map(([repoName, { url, skills }]) => (
                <div key={repoName} className={`p-4 rounded-xl border ${
                  isDarkMode ? 'bg-zinc-900/50 border-white/5' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Github className={`w-4 h-4 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`} />
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className={`text-sm font-medium hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                    >
                      {repoName}
                    </a>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => toggleSkillSelection(skill)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                          selectedSkills.has(skill)
                            ? isDarkMode
                              ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                              : 'bg-indigo-100 border-indigo-300 text-indigo-700'
                            : isDarkMode
                              ? 'bg-zinc-800/50 border-white/10 text-zinc-500'
                              : 'bg-gray-100 border-gray-300 text-gray-500'
                        }`}
                      >
                        <span className="text-sm font-medium">{skill}</span>
                        {selectedSkills.has(skill) ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-current" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Footer Actions */}
          <div className={`px-8 py-6 border-t flex items-center justify-between ${
            isDarkMode ? 'border-white/5 bg-zinc-900/50' : 'border-gray-100 bg-gray-50'
          }`}>
            <div className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              {selectedSkills.size} of {pendingSkills.length} skills selected
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleDismissAnalysis} 
                className={`px-6 py-2 rounded-xl font-medium ${
                  isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Dismiss
              </button>
              <button 
                onClick={handleAcceptSkills}
                disabled={selectedSkills.size === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add {selectedSkills.size} Skill{selectedSkills.size !== 1 ? 's' : ''} to Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};
