import React, { useState } from 'react';

export const SkillGapAnalysis = ({ candidate, onClose }) => {
  const [step, setStep] = useState('input'); // 'input' | 'analyzing' | 'results'
  const [targetRole, setTargetRole] = useState('');
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!targetRole.trim() || !transcript.trim()) {
      setError('Please fill in both target role and interview transcript');
      return;
    }

    setStep('analyzing');
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/skill-gap/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          candidate_id: candidate.id,
          interview_transcript: transcript,
          target_role: targetRole
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze interview');
      }

      const data = await response.json();
      setAnalysis(data);
      setStep('results');
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze interview. Please try again.');
      setStep('input');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return 'bg-red-100 text-red-800 border-red-200';
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 text-white rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold flex items-center">
                <span className="mr-2">📊</span>
                Skill Gap Analysis
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                {candidate.name} • {candidate.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'input' && (
            <div className="space-y-6">
              {/* Candidate Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Candidate Profile</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Experience:</span>
                    <span className="ml-2 font-medium">{candidate.experience_years} years</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Role:</span>
                    <span className="ml-2 font-medium">{candidate.current_role}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-gray-600 text-sm">Current Skills:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {candidate.skills?.slice(0, 10).map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Target Role *
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g., Senior Full-Stack Engineer, ML Engineer, DevOps Lead"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Interview Transcript *
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste the interview transcript here. Include technical discussions, problem-solving approaches, and any code or system design explanations..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={12}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tip: Include detailed technical discussions for better analysis
                  </p>
                </div>

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <button
                  onClick={handleAnalyze}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg font-semibold"
                >
                  🔍 Analyze Interview
                </button>
              </div>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Agent is working on it...</h3>
              <p className="text-gray-600 text-center max-w-md">
                Our AI is analyzing the transcript to identify skill gaps, strengths, and create a personalized learning roadmap
              </p>
            </div>
          )}

          {step === 'results' && analysis && (
            <div className="space-y-6">
              {/* Overall Assessment */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xl font-bold text-gray-900">Overall Assessment</h4>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${getScoreColor(analysis.readiness_score)}`}>
                      {analysis.readiness_score}%
                    </div>
                    <div className="text-xs text-gray-600">Readiness Score</div>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">{analysis.analysis_summary}</p>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full font-medium">
                    ⏱️ {analysis.deployment_timeline}
                  </span>
                </div>
              </div>

              {/* Strengths */}
              {analysis.strengths && analysis.strengths.length > 0 && (
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">💪</span>
                    Strengths
                  </h4>
                  <ul className="space-y-2">
                    {analysis.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span className="text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Skill Gaps */}
              {analysis.skill_gaps && analysis.skill_gaps.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">🎯</span>
                    Skill Gaps to Address
                  </h4>
                  <div className="space-y-3">
                    {analysis.skill_gaps.map((gap, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-gray-900">{gap.skill}</h5>
                              <span className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(gap.priority)}`}>
                                {gap.priority} priority
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Current:</span> {gap.current_level}
                              <span className="mx-2">→</span>
                              <span className="font-medium">Target:</span> {gap.target_level}
                            </div>
                            {gap.impact && (
                              <div className="text-xs text-gray-500 mt-1">
                                Impact: {gap.impact}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning Roadmap */}
              {analysis.learning_roadmap && analysis.learning_roadmap.phases && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">🗺️</span>
                    Personalized Learning Roadmap
                  </h4>
                  <div className="mb-4 flex gap-4 text-sm">
                    <div className="px-3 py-2 bg-blue-50 rounded-lg">
                      <span className="text-blue-600 font-semibold">
                        {analysis.learning_roadmap.total_duration_weeks} weeks
                      </span>
                      <span className="text-gray-600 ml-1">total</span>
                    </div>
                    <div className="px-3 py-2 bg-purple-50 rounded-lg">
                      <span className="text-purple-600 font-semibold">
                        ~{analysis.learning_roadmap.total_estimated_hours} hours
                      </span>
                      <span className="text-gray-600 ml-1">estimated</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {analysis.learning_roadmap.phases.map((phase, idx) => (
                      <div key={idx} className="border-l-4 border-purple-500 pl-4 py-2">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-gray-900">{phase.name}</h5>
                          <span className="text-sm text-gray-600">{phase.duration_weeks} weeks</span>
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-medium">Skills:</span> {phase.skills_to_learn.join(', ')}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Milestones:</span>
                          <ul className="mt-1 space-y-1">
                            {phase.milestones.map((milestone, midx) => (
                              <li key={midx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{milestone}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Courses */}
              {analysis.recommended_courses && analysis.recommended_courses.length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="mr-2">📚</span>
                    Recommended Courses
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.recommended_courses.map((course, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <h5 className="font-semibold text-gray-900 text-sm">{course.course_name}</h5>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${course.cost === 'free' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                            {course.cost}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <div><span className="font-medium">Platform:</span> {course.platform}</div>
                          <div><span className="font-medium">Duration:</span> {course.duration}</div>
                          <div><span className="font-medium">Level:</span> {course.difficulty}</div>
                          <div><span className="font-medium">For:</span> {course.skill}</div>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">{course.relevance}</p>
                        <a
                          href={course.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                        >
                          View Course →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setStep('input');
                    setAnalysis(null);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  New Analysis
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
