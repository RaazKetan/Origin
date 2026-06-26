import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, X, ChevronRight, Check } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const GlobalAnalysisPopup = ({ isDarkMode = true, onAnalysisComplete }) => {
  const [analysisStatus, setAnalysisStatus] = useState(null);
  const [pendingSkills, setPendingSkills] = useState([]);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState(new Set());
  const [isAccepting, setIsAccepting] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  // Poll analysis status
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let timeoutId;
    
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/analysis/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setAnalysisStatus(data);
          
          if (data.has_pending_analysis) {
            setShowNotification(true);
            timeoutId = setTimeout(checkStatus, 5000); // Check every 5s while pending
          } else if (data.analysis_complete) {
            setShowNotification(true);
            fetchPendingSkills();
            
            // Notify parent to fetch updated profile
            if (onAnalysisComplete) {
                onAnalysisComplete();
            }
          } else {
              setShowNotification(false);
          }
        }
      } catch (err) {
        console.error("Error checking analysis status:", err);
      }
    };

    checkStatus();

    return () => clearTimeout(timeoutId);
  }, []);

  const fetchPendingSkills = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/analysis/pending-skills`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingSkills(data.skills || []);
        if (data.skills && data.skills.length > 0) {
            setShowSkillsModal(true);
            // Auto-select top 5 skills based on occurrences or just the first few
            const initialSelected = new Set(data.skills.slice(0, 10).map(s => s.skill));
            setSelectedSkills(initialSelected);
        }
      }
    } catch (err) {
      console.error("Error fetching pending skills:", err);
    }
  };

  const handleAcceptSkills = async () => {
    const token = localStorage.getItem('token');
    setIsAccepting(true);
    try {
      const res = await fetch(`${API_BASE}/analysis/accept-skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          accepted_skills: Array.from(selectedSkills)
        })
      });

      if (res.ok) {
        setShowSkillsModal(false);
        setPendingSkills([]);
        // Clear notification on success
        setShowNotification(false);
        
        // Let the parent app know to refetch the profile as skills were added
        if (onAnalysisComplete) {
            onAnalysisComplete();
        }
      }
    } catch (err) {
      console.error("Error accepting skills:", err);
    } finally {
      setIsAccepting(false);
    }
  };

  const toggleSkill = (skill) => {
    const newSelected = new Set(selectedSkills);
    if (newSelected.has(skill)) {
      newSelected.delete(skill);
    } else {
      newSelected.add(skill);
    }
    setSelectedSkills(newSelected);
  };

  // Dont render anything if not tracking status
  if (!showNotification && !showSkillsModal) return null;

  return (
    <>
      {/* Mini Notification overlay (Bottom Right) */}
      {showNotification && !showSkillsModal && analysisStatus && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300">
           <div className={`p-4 rounded-xl shadow-lg border ${
            isDarkMode 
              ? 'bg-[#1a1a1a] border-white/10' 
              : 'bg-white border-gray-200'
          }`}>
             
             {analysisStatus.has_pending_analysis ? (
               <div className="flex items-center gap-3">
                 <Loader2 className={`w-5 h-5 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                 <div>
                    <h4 className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Background Analysis Running
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                        Evaluating your repositories...
                    </p>
                 </div>
               </div>
             ) : analysisStatus.analysis_complete ? (
                <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                        <div>
                            <h4 className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                Analysis Complete!
                            </h4>
                            <p className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                                Portfolio score updated.
                            </p>
                        </div>
                    </div>
                    {pendingSkills.length > 0 && (
                        <button
                          onClick={() => setShowSkillsModal(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isDarkMode 
                              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          Review Skills
                        </button>
                    )}
                     <button
                        onClick={() => setShowNotification(false)}
                        className={`p-1 rounded-md transition-all ${
                        isDarkMode ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
             ) : null}
          </div>
        </div>
      )}

      {/* Skills Review Modal */}
      {showSkillsModal && pendingSkills.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`max-w-2xl w-full rounded-2xl shadow-2xl border ${
            isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'
          } overflow-hidden flex flex-col max-h-[90vh]`}>
            
            {/* Header */}
            <div className={`p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                    <CheckCircle className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    New Skills Detected
                  </h2>
                </div>
                <button
                  onClick={() => setShowSkillsModal(false)}
                  className={`p-2 rounded-lg transition-all ${
                    isDarkMode ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                We analyzed your repositories and found these skills. Select the ones you want to add to your profile.
              </p>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Group skills by repository for better context */}
              {Object.entries(
                pendingSkills.reduce((acc, curr) => {
                  if (!acc[curr.repo_name]) acc[curr.repo_name] = [];
                  acc[curr.repo_name].push(curr);
                  return acc;
               }, {})
              ).map(([repoName, skills]) => (
                <div key={repoName} className="mb-6 last:mb-0">
                  <div className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    From: {repoName}
                  </div>
                  <div className="flex flex-wrap gap-2 pl-3">
                    {skills.map((item, idx) => {
                      const isSelected = selectedSkills.has(item.skill);
                      return (
                        <button
                          key={`${repoName}-${item.skill}-${idx}`}
                          onClick={() => toggleSkill(item.skill)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? isDarkMode
                                ? 'bg-blue-500 text-white border border-blue-400'
                                : 'bg-blue-600 text-white border border-blue-500'
                              : isDarkMode
                                ? 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10'
                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {item.skill}
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`p-6 border-t ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'} flex justify-between items-center mt-auto`}>
              <span className={`text-sm font-medium ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                {selectedSkills.size} skills selected
              </span>
              <div className="flex gap-3">
                 <button
                    onClick={() => setShowSkillsModal(false)}
                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                      isDarkMode 
                        ? 'text-zinc-300 hover:bg-white/10' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleAcceptSkills}
                    disabled={isAccepting || selectedSkills.size === 0}
                    className={`px-6 py-2 rounded-xl text-white font-medium transition-all flex items-center gap-2 ${
                      isAccepting || selectedSkills.size === 0
                        ? 'opacity-50 cursor-not-allowed bg-blue-500/50'
                        : 'bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/20'
                    }`}
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Accept Selected
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
