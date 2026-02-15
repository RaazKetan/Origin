import React, { useState } from 'react';
import { Upload, FileText, Github, Award, GraduationCap, Award as Certificate, Loader2, CheckCircle, ArrowRight, ArrowLeft, X, Plus } from 'lucide-react';

const API_BASE = "http://localhost:8000";

export const ProfileSetup = ({ onComplete, isDarkMode = true }) => {
  const [step, setStep] = useState('welcome'); // welcome, choice, resume, manual, analyzing, complete
  const [setupMethod, setSetupMethod] = useState(null); // 'resume' or 'manual'
  const [resumeFile, setResumeFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [portfolioResult, setPortfolioResult] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    githubRepos: [],
    awards: [],
    skills: [],
    collegeName: '',
    collegeGpa: '',
    collegeYears: '',
    certifications: [],
    bio: ''
  });

  // Input states for adding new items
  const [newSkill, setNewSkill] = useState('');
  const [newRepo, setNewRepo] = useState('');
  const [newAward, setNewAward] = useState('');
  const [newCert, setNewCert] = useState('');

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.docx')) {
      alert('Please upload a PDF or DOCX file');
      return;
    }

    setResumeFile(file);
    setIsUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formDataObj = new FormData();
      formDataObj.append('file', file);

      const res = await fetch(`${API_BASE}/profile-setup/upload-resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formDataObj
      });

      if (res.ok) {
        const data = await res.json();
        setParsedData(data);
        
        // Pre-fill form with parsed data
        setFormData({
          githubRepos: data.github_repos || [],
          awards: data.awards || [],
          skills: data.skills || [],
          collegeName: data.college_name || '',
          collegeGpa: data.college_gpa || '',
          collegeYears: data.college_years || '',
          certifications: data.certifications || [],
          bio: ''
        });
        
        setStep('resume');
      } else {
        const error = await res.text();
        alert(`Failed to parse resume: ${error}`);
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      alert('Failed to upload resume. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Tile management functions
  const addSkill = () => {
    if (newSkill.trim()) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill('');
    }
  };

  const removeSkill = (index) => {
    setFormData({ ...formData, skills: formData.skills.filter((_, i) => i !== index) });
  };

  const addRepo = () => {
    if (newRepo.trim()) {
      if (formData.githubRepos.length >= 5) {
        alert('Maximum 5 GitHub repositories allowed');
        return;
      }
      if (!newRepo.includes('github.com')) {
        alert('Please enter a valid GitHub URL');
        return;
      }
      setFormData({ ...formData, githubRepos: [...formData.githubRepos, newRepo.trim()] });
      setNewRepo('');
    }
  };

  const removeRepo = (index) => {
    setFormData({ ...formData, githubRepos: formData.githubRepos.filter((_, i) => i !== index) });
  };

  const addAward = () => {
    if (newAward.trim()) {
      setFormData({ ...formData, awards: [...formData.awards, newAward.trim()] });
      setNewAward('');
    }
  };

  const removeAward = (index) => {
    setFormData({ ...formData, awards: formData.awards.filter((_, i) => i !== index) });
  };

  const addCertification = () => {
    if (newCert.trim()) {
      setFormData({ ...formData, certifications: [...formData.certifications, newCert.trim()] });
      setNewCert('');
    }
  };

  const removeCertification = (index) => {
    setFormData({ ...formData, certifications: formData.certifications.filter((_, i) => i !== index) });
  };

  const handleCompleteProfile = async () => {
    // Validate GitHub repos (1-5 required)
    if (formData.githubRepos.length < 1) {
      alert('Please add at least 1 GitHub repository');
      return;
    }
    if (formData.githubRepos.length > 5) {
      alert('Maximum 5 GitHub repositories allowed');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setStep('analyzing');

    try {
      const token = localStorage.getItem('token');
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const payload = {
        setup_method: setupMethod,
        github_repos: formData.githubRepos,
        awards: formData.awards,
        skills: formData.skills,
        college_name: formData.collegeName,
        college_gpa: formData.collegeGpa,
        college_years: formData.collegeYears,
        certifications: formData.certifications,
        bio: formData.bio
      };

      const res = await fetch(`${API_BASE}/profile-setup/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (res.ok) {
        const userData = await res.json();
        setPortfolioResult({
          score: userData.portfolio_score || 50,
          rank: userData.portfolio_rank || 'Intermediate'
        });
        setStep('complete');
        
        // Wait a bit before calling onComplete
        setTimeout(() => {
          onComplete();
        }, 3000);
      } else {
        const error = await res.text();
        alert(`Failed to complete profile: ${error}`);
        setStep(setupMethod === 'resume' ? 'resume' : 'manual');
      }
    } catch (error) {
      console.error('Error completing profile:', error);
      alert('Failed to complete profile. Please try again.');
      setStep(setupMethod === 'resume' ? 'resume' : 'manual');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 'Expert': return 'text-purple-500';
      case 'Advanced': return 'text-blue-500';
      case 'Intermediate': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getRankBg = (rank) => {
    switch (rank) {
      case 'Expert': return 'bg-purple-500/20';
      case 'Advanced': return 'bg-blue-500/20';
      case 'Intermediate': return 'bg-green-500/20';
      default: return 'bg-gray-500/20';
    }
  };

  // Tile component for reusable styling
  const Tile = ({ children, onRemove, color = 'blue' }) => (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
      isDarkMode 
        ? `bg-${color}-500/10 border-${color}-500/20 text-${color}-300` 
        : `bg-${color}-50 border-${color}-100 text-${color}-700`
    } group transition-all hover:shadow-md`}>
      <span className="text-sm font-medium">{children}</span>
      <button
        onClick={onRemove}
        className={`p-0.5 rounded-full transition-all ${
          isDarkMode ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-600'
        }`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // Welcome Step
  if (step === 'welcome') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className={`text-5xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Welcome to Conekt! 🎉
            </h1>
            <p className={`text-xl ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              Let's set up your profile to help you find the perfect collaborations
            </p>
          </div>

          <div className={`rounded-2xl p-8 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Upload Your Resume (Optional)
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                    We'll automatically extract your skills, education, and achievements
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                  <Github className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Add GitHub Repositories (Required)
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Share 1-5 of your best projects for AI analysis and portfolio ranking
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                  <CheckCircle className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Get Your Portfolio Score
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Receive a ranking based on your projects and skills
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('choice')}
              className="w-full mt-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Choice Step
  if (step === 'choice') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              How would you like to set up your profile?
            </h2>
            <p className={`${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              Choose the method that works best for you
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Resume Upload Option */}
            <div
              onClick={() => {
                setSetupMethod('resume');
                document.getElementById('resume-upload').click();
              }}
              className={`p-8 rounded-2xl cursor-pointer transition-all ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10' 
                  : 'bg-white border border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                <Upload className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Upload Resume
              </h3>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                Quick and easy! We'll automatically extract your information from your resume (PDF or DOCX)
              </p>
              <div className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                Recommended for faster setup →
              </div>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.docx"
                onChange={handleResumeUpload}
                className="hidden"
              />
            </div>

            {/* Manual Entry Option */}
            <div
              onClick={() => {
                setSetupMethod('manual');
                setStep('manual');
              }}
              className={`p-8 rounded-2xl cursor-pointer transition-all ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10' 
                  : 'bg-white border border-gray-200 hover:border-green-300'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <FileText className="w-8 h-8 text-green-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Manual Entry
              </h3>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                Fill in your information manually if you don't have a resume ready
              </p>
              <div className={`text-sm font-medium ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                More control over details →
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="mt-6 text-center">
              <Loader2 className={`w-8 h-8 animate-spin mx-auto ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <p className={`mt-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                Parsing your resume...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Resume Review / Manual Entry Step
  if (step === 'resume' || step === 'manual') {
    return (
      <div className={`min-h-screen p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto py-8">
          <div className="mb-8">
            <button
              onClick={() => setStep('choice')}
              className={`flex items-center gap-2 ${isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <h2 className={`text-3xl font-bold mt-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {step === 'resume' ? 'Review & Edit Your Information' : 'Enter Your Information'}
            </h2>
            <p className={`mt-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              {step === 'resume' 
                ? 'Review the extracted information and make any necessary edits' 
                : 'Fill in your profile details'}
            </p>
          </div>

          <div className="space-y-6">
            {/* GitHub Repositories */}
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <Github className={`w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  GitHub Repositories (1-5 required)
                </h3>
              </div>
              
              {/* Tiles Display */}
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.githubRepos.map((repo, index) => (
                  <Tile key={index} onRemove={() => removeRepo(index)} color="blue">
                    {repo.replace('https://github.com/', '')}
                  </Tile>
                ))}
              </div>

              {/* Add Input */}
              {formData.githubRepos.length < 5 && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://github.com/username/repository"
                    value={newRepo}
                    onChange={(e) => setNewRepo(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRepo()}
                    className={`flex-1 px-4 py-3 rounded-lg ${
                      isDarkMode 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                        : 'bg-gray-50 border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <button
                    onClick={addRepo}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      isDarkMode 
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Skills */}
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Skills
              </h3>
              
              {/* Tiles Display */}
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.skills.map((skill, index) => (
                  <Tile key={index} onRemove={() => removeSkill(index)} color="purple">
                    {skill}
                  </Tile>
                ))}
              </div>

              {/* Add Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., React, Python, Machine Learning"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                  className={`flex-1 px-4 py-3 rounded-lg ${
                    isDarkMode 
                      ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-gray-50 border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <button
                  onClick={addSkill}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isDarkMode 
                      ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                      : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  Add
                </button>
              </div>
            </div>

            {/* Awards */}
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <Award className={`w-6 h-6 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Awards & Activities
                </h3>
              </div>
              
              {/* Tiles Display */}
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.awards.map((award, index) => (
                  <Tile key={index} onRemove={() => removeAward(index)} color="yellow">
                    {award}
                  </Tile>
                ))}
              </div>

              {/* Add Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Hackathon Winner, Dean's List"
                  value={newAward}
                  onChange={(e) => setNewAward(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAward()}
                  className={`flex-1 px-4 py-3 rounded-lg ${
                    isDarkMode 
                      ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-gray-50 border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <button
                  onClick={addAward}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isDarkMode 
                      ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                      : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  Add
                </button>
              </div>
            </div>

            {/* College Info */}
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <GraduationCap className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Education
                </h3>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="College/University Name"
                  value={formData.collegeName}
                  onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                  className={`w-full px-4 py-3 rounded-lg ${
                    isDarkMode 
                      ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-gray-50 border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="GPA (e.g., 3.8/4.0)"
                    value={formData.collegeGpa}
                    onChange={(e) => setFormData({ ...formData, collegeGpa: e.target.value })}
                    className={`px-4 py-3 rounded-lg ${
                      isDarkMode 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                        : 'bg-gray-50 border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  <input
                    type="text"
                    placeholder="Years (e.g., 2020-2024)"
                    value={formData.collegeYears}
                    onChange={(e) => setFormData({ ...formData, collegeYears: e.target.value })}
                    className={`px-4 py-3 rounded-lg ${
                      isDarkMode 
                        ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                        : 'bg-gray-50 border border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>
            </div>

            {/* Certifications */}
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-4">
                <Certificate className={`w-6 h-6 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Certifications
                </h3>
              </div>
              
              {/* Tiles Display */}
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.certifications.map((cert, index) => (
                  <Tile key={index} onRemove={() => removeCertification(index)} color="indigo">
                    {cert}
                  </Tile>
                ))}
              </div>

              {/* Add Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., AWS Certified Developer"
                  value={newCert}
                  onChange={(e) => setNewCert(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCertification()}
                  className={`flex-1 px-4 py-3 rounded-lg ${
                    isDarkMode 
                      ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                      : 'bg-gray-50 border border-gray-300 text-gray-900'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <button
                  onClick={addCertification}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    isDarkMode 
                      ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' 
                      : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  Add
                </button>
              </div>
            </div>

            {/* Bio */}
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Bio
              </h3>
              <textarea
                placeholder="Tell us about yourself..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className={`w-full px-4 py-3 rounded-lg ${
                  isDarkMode 
                    ? 'bg-white/5 border border-white/10 text-white placeholder-zinc-500' 
                    : 'bg-gray-50 border border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleCompleteProfile}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              Analyze & Complete Profile
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Analyzing Step
  if (step === 'analyzing') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className="max-w-md w-full">
          <div className="text-center">
            <Loader2 className={`w-16 h-16 animate-spin mx-auto mb-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Setting Up Your Profile
            </h2>
            <p className={`mb-6 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              Your repositories will be analyzed in the background...
            </p>
            
            {/* Progress Bar */}
            <div className={`w-full h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}>
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
              {analysisProgress}%
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Complete Step
  if (step === 'complete') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className="max-w-md w-full">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            
            <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Profile Complete! 🎉
            </h2>
            <p className={`mb-8 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              Your profile has been set up successfully
            </p>

            {portfolioResult && (
              <div className={`p-6 rounded-xl mb-6 ${isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                <p className={`text-sm mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Your Portfolio Score
                </p>
                <div className={`text-5xl font-bold mb-2 ${getRankColor(portfolioResult.rank)}`}>
                  {portfolioResult.score}
                </div>
                <div className={`inline-block px-4 py-2 rounded-full ${getRankBg(portfolioResult.rank)}`}>
                  <span className={`font-semibold ${getRankColor(portfolioResult.rank)}`}>
                    {portfolioResult.rank}
                  </span>
                </div>
              </div>
            )}

            <p className={`text-sm ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
              Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
