import React, { useState } from 'react';
import { API_BASE } from '../lib/api';


export const RequirementsPage = ({ onBack, onGetRecommendations }) => {
  const [requirements, setRequirements] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  const handleAnalyze = async () => {
    if (!requirements.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/requirements/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requirements: requirements.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data || []);
      } else {
        console.error('Failed to analyze requirements');
        alert('Failed to analyze requirements. Please try again.');
      }
    } catch (error) {
      console.error('Error analyzing requirements:', error);
      alert('Error analyzing requirements. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-3xl p-8 shadow-sm border border-gray-200 mt-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Find Collaborators</h2>
        <button
          onClick={onBack}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
        >
          Back
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Describe your project requirements and what kind of collaborators you're looking for:
        </label>
        <textarea
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 text-black"
          placeholder="e.g., I need a full-stack developer for a React + Node.js e-commerce platform..."
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
        />
      </div>

      <button
        onClick={handleAnalyze}
        disabled={!requirements.trim() || isAnalyzing}
        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isAnalyzing ? 'Agent is working on it...' : 'Find Matching Collaborators'}
      </button>

      {recommendations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Recommended Collaborators</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((user) => (
              <div key={user.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-3">
                  {user.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-12 h-12 rounded-full mr-3"
                    />
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-800">{user.name}</h4>
                    <p className="text-sm text-gray-600">@{user.username}</p>
                  </div>
                </div>
                
                {user.bio && (
                  <p className="text-sm text-gray-700 mb-3">{user.bio}</p>
                )}

                {user.skills && user.skills.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {user.skills.slice(0, 4).map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-[#E7ECEF] text-[#274C77] text-xs rounded border border-[#A3CEF1]"
                        >
                          {skill}
                        </span>
                      ))}
                      {user.skills.length > 4 && (
                        <span
                          className="px-2 py-1 bg-[#E7ECEF] text-[#274C77] text-xs rounded border border-[#A3CEF1]"
                        >
                          +{user.skills.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {user.org_name && (
                  <p className="text-xs text-gray-500 mb-2">
                    {user.org_type === 'college' ? '🎓' : '🏢'} {user.org_name}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => onGetRecommendations(user)}
                    className="flex-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-500"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => onGetRecommendations(user, true)}
                    className="flex-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                  >
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
