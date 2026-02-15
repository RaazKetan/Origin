import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  GitCommit, Menu, X, Github, ArrowRight, 
  Brain, GitGraph, Target, Zap, 
  Terminal, Play, Loader2, CheckCircle2, AlertCircle, BookOpen,
  Moon, Sun, Sparkles, Code2
} from 'lucide-react';

export const LandingPage = ({ onLogin, onRegister, isLoading }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Demo state
  const SAMPLE_CODE = `commit 8f3a12b
Author: DevUser <dev@origin.ai>
Date:   Wed Oct 25 14:30:00 2023 +0000

    refactor: implement recursive fiber tree traversal
    
    Replaced the iterative stack approach with a recursive 
    solution to handle deeply nested component trees more 
    gracefully. Added memoization to prevent re-rendering.

diff --git a/src/reconciler.ts b/src/reconciler.ts
index 4a12c..9b33d 100644
--- a/src/reconciler.ts
+++ b/src/reconciler.ts
@@ -45,12 +45,18 @@ function traverse(root: FiberNode) {
-  const stack = [root];
-  while (stack.length > 0) {
-    const node = stack.pop();
-    process(node);
-    if (node.child) stack.push(node.child);
-    if (node.sibling) stack.push(node.sibling);
-  }
+  if (!root) return;
+  
+  // Memoize the process to avoid heavy recalc
+  const processed = useMemo(() => process(root), [root.props]);
+  
+  if (root.child) traverse(root.child);
+  if (root.sibling) traverse(root.sibling);
 }
`;

  const [code, setCode] = useState(SAMPLE_CODE);
  const [stage, setStage] = useState('IDLE');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(formData.email, formData.password);
    } else {
      if (formData.password !== formData.confirmPassword) {
        alert("Passwords don't match!");
        return;
      }
      onRegister(formData.name, formData.email, formData.password);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newTheme = !prev;
      localStorage.setItem('theme', newTheme ? 'dark' : 'light');
      return newTheme;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const scrollToAuth = () => {
    document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const analyzeCommit = async (codeSnippet) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyACJX5GdXHk9dadwocf32zrTdRSpJ-iNsA';
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: `You are Origin, an advanced AI agent for the tech recruitment sector. 
Your goal is to analyze code commits and diffs to extract the developer's true latent skills.
You don't just look for keywords; you look for problem-solving patterns, architectural decisions, and code quality.
You also identify gaps in their knowledge based on the code provided and suggest specific, real-world courses or topics to study.`,
    });

    const prompt = `Analyze the following git commit diff/code snippet. 
Extract the technical skills demonstrated, soft skills (like attention to detail, clarity), 
areas where the code could be improved, and suggest courses to bridge those gaps.

Return a JSON object with this structure:
{
  "technicalSkills": ["skill1", "skill2"],
  "softSkills": ["skill1", "skill2"],
  "improvementAreas": ["area1", "area2"],
  "suggestedCourses": [
    {"title": "Course Name", "platform": "Platform", "reason": "Why this course"}
  ],
  "complexityScore": 85
}

Code Snippet:
${codeSnippet}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/```\n?([\s\S]*?)\n?```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    
    return JSON.parse(jsonText);
  };

  const handleAnalyze = useCallback(async () => {
    if (stage !== 'IDLE' && stage !== 'COMPLETE') return;
    
    setError(null);
    setAnalysis(null);
    setStage('READING_COMMITS');

    try {
      setTimeout(() => setStage('ANALYZING_PATTERNS'), 800);
      setTimeout(() => setStage('GENERATING_PATH'), 1800);
      
      const result = await analyzeCommit(code);
      
      setAnalysis(result);
      setStage('COMPLETE');
    } catch (err) {
      console.error('Analysis error:', err);
      setStage('IDLE');
      
      setError("Demo mode: Using sample data");
      setTimeout(() => {
        setAnalysis({
          technicalSkills: ["React Fiber Architecture", "Recursion", "Memoization", "Performance Optimization"],
          softSkills: ["Clear Commit Messaging", "Refactoring", "Problem Solving"],
          improvementAreas: ["Recursion depth limits in JS", "Stack overflow handling"],
          suggestedCourses: [
            { title: "Advanced Data Structures in JS", platform: "Origin Learn", reason: "Handle large trees efficiently" },
            { title: "React Internals Deep Dive", platform: "Frontend Masters", reason: "Master the reconciliation process" }
          ],
          complexityScore: 85
        });
        setStage('COMPLETE');
        setError(null);
      }, 2000);
    }
  }, [code, stage]);

  const bgClass = isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50';
  const textClass = isDarkMode ? 'text-slate-50' : 'text-gray-900';

  return (
    <div className={`min-h-screen ${bgClass} ${textClass} selection:bg-blue-500/30 font-sans transition-colors duration-300`}>
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${isDarkMode ? 'border-white/5 bg-[#0a0a0a]/80' : 'border-gray-200 bg-white/80'} border-b backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-white' : 'bg-gray-900'}`}>
              <GitCommit className={`w-5 h-5 ${isDarkMode ? 'text-black' : 'text-white'}`} />
            </div>
            <span className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>origin</span>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-secondary">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#demo" className="hover:text-white transition-colors">Demo</a>
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => {
                setIsLoginMode(true);
                scrollToAuth();
              }}
              className="text-white hover:text-gray-300 transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => {
                setIsLoginMode(false);
                scrollToAuth();
              }}
              className="bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              Get Started
            </button>
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={isDarkMode ? 'text-white' : 'text-gray-900'}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className={`md:hidden absolute top-16 left-0 right-0 border-b p-4 flex flex-col space-y-4 ${isDarkMode ? 'bg-[#0f0f11] border-white/5' : 'bg-white border-gray-200'}`}>
            <a href="#features" className={`${isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Features</a>
            <a href="#demo" className={`${isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Demo</a>
            <button 
              onClick={() => {
                setIsLoginMode(true);
                scrollToAuth();
                setIsMenuOpen(false);
              }}
              className={`text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            >
              Log in
            </button>
            <button 
              onClick={() => {
                setIsLoginMode(false);
                scrollToAuth();
                setIsMenuOpen(false);
              }}
              className={`px-4 py-2 rounded-full w-full ${isDarkMode ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}
            >
              Get Started
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        <div className={`absolute inset-0 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] ${isDarkMode ? 'bg-blue-500/5' : 'bg-blue-500/10'}`} />
          <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent ${isDarkMode ? 'via-white/10' : 'via-gray-300'}`} />
          {isDarkMode && <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.015] mix-blend-overlay pointer-events-none" />}
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center z-10">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className={`text-xs font-medium ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Origin AI 2.0 is now live</span>
          </div>

          <h1 className={`text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Hiring based on <br />
            <span className="gradient-text">Proof, not Promises.</span>
          </h1>

          <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
            Your résumé is outdated. Origin connects your GitHub activity directly to opportunities. 
            Our AI agents analyze your code patterns to prove your skills and suggest paths to master new ones.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button 
              onClick={() => {
                setIsLoginMode(false);
                scrollToAuth();
              }}
              className={`h-12 px-8 rounded-full font-semibold transition-all flex items-center gap-2 group ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
            >
              <Github className="w-5 h-5" />
              <span>Connect GitHub</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={scrollToAuth}
              className={`h-12 px-8 rounded-full border font-semibold transition-all ${isDarkMode ? 'bg-transparent border-white/20 text-white hover:bg-white/5' : 'bg-transparent border-gray-300 text-gray-900 hover:bg-gray-100'}`}
            >
              View Sample Profile
            </button>
          </div>

          <div className={`mt-20 pt-10 border-t flex flex-wrap justify-center gap-10 md:gap-20 ${isDarkMode ? 'border-white/5' : 'border-gray-200'}`}>
            <div className="text-center group cursor-default">
              <div className={`text-3xl md:text-4xl font-bold mb-2 transition-colors ${isDarkMode ? 'text-white group-hover:text-blue-400' : 'text-gray-900 group-hover:text-blue-600'}`}>10M+</div>
              <div className={`text-xs uppercase tracking-widest font-semibold ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Lines Analyzed</div>
            </div>
            <div className="text-center group cursor-default">
              <div className={`text-3xl md:text-4xl font-bold mb-2 transition-colors ${isDarkMode ? 'text-white group-hover:text-green-400' : 'text-gray-900 group-hover:text-green-600'}`}>85%</div>
              <div className={`text-xs uppercase tracking-widest font-semibold ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Placement Rate</div>
            </div>
            <div className="text-center group cursor-default">
              <div className={`text-3xl md:text-4xl font-bold mb-2 transition-colors ${isDarkMode ? 'text-white group-hover:text-purple-400' : 'text-gray-900 group-hover:text-purple-600'}`}>24/7</div>
              <div className={`text-xs uppercase tracking-widest font-semibold ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>AI Agent Mentorship</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className={`py-24 border-t transition-colors ${isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>The Future of Work</h2>
            <p className={`max-w-2xl ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              Origin replaces the traditional recruiting funnel with a direct data pipeline from your code editor to your next contract.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              { icon: GitGraph, title: "Deep Context Analysis", desc: "We don't just count commits. We read diffs, understand architectural decisions, and evaluate code complexity to build a true skill graph.", span: "lg:col-span-2" },
              { icon: Target, title: "Precision Matching", desc: "Get matched with projects that require exactly the skills you've proven you possess.", span: "lg:col-span-1" },
              { icon: Brain, title: "AI Skill Gap Agents", desc: "Our agents monitor job trends and your repo, suggesting specific micro-courses to fill knowledge gaps instantly.", span: "lg:col-span-1" },
              { icon: Zap, title: "Instant Verification", desc: "No more take-home tests. Your previous work is your test. Instant verification for 50+ languages.", span: "lg:col-span-2" }
            ].map((feature, idx) => (
              <div 
                key={idx}
                className={`group relative rounded-2xl p-8 transition-all duration-300 ${feature.span} ${isDarkMode ? 'glass-panel hover:bg-white/10' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}
              >
                <div className={`absolute top-8 right-8 transition-colors ${isDarkMode ? 'text-white/10 group-hover:text-white/20' : 'text-gray-300 group-hover:text-gray-400'}`}>
                  <feature.icon className="w-12 h-12" />
                </div>
                <div className="h-full flex flex-col justify-end relative z-10">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-6 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-900'}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className={`text-xl font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{feature.title}</h3>
                  <p className={`leading-relaxed ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section id="demo" className={`py-24 relative overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0a] border-t border-white/5' : 'bg-gray-50 border-t border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="text-center mb-16">
            <h2 className={`text-3xl md:text-4xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>See Origin in Action</h2>
            <p className={`max-w-2xl mx-auto ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
              Paste a commit diff or use the sample below. Our AI agents read the code, not just the keywords, to understand your true capability.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:h-[500px]">
            <div className={`rounded-xl p-1 flex flex-col h-full overflow-hidden shadow-xl ${isDarkMode ? 'glass-panel' : 'bg-white border border-gray-200'}`}>
              <div className={`px-4 py-3 flex items-center justify-between border-b ${isDarkMode ? 'bg-black/50 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center space-x-2">
                  <Terminal className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  <span className={`text-sm font-mono ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>commit_diff.patch</span>
                </div>
                <button 
                  onClick={() => setCode(SAMPLE_CODE)}
                  className={`text-xs transition-colors ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Reset Sample
                </button>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`flex-1 font-mono text-sm p-4 resize-none focus:outline-none ${isDarkMode ? 'bg-black/80 text-gray-300' : 'bg-white text-gray-900'}`}
                spellCheck={false}
              />
              <div className={`p-4 border-t ${isDarkMode ? 'bg-black/50 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <button
                  onClick={handleAnalyze}
                  disabled={stage !== 'IDLE' && stage !== 'COMPLETE'}
                  className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg font-medium transition-all duration-300 ${
                    stage === 'IDLE' || stage === 'COMPLETE' 
                      ? isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'
                      : isDarkMode ? 'bg-white/10 text-white cursor-wait' : 'bg-gray-200 text-gray-600 cursor-wait'
                  }`}
                >
                  {stage === 'IDLE' || stage === 'COMPLETE' ? (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Analyze Code</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  )}
                </button>
                {error && (
                  <p className="text-xs text-orange-400 mt-2 text-center">{error}</p>
                )}
              </div>
            </div>

            <div className={`rounded-xl p-6 h-full overflow-y-auto ${isDarkMode ? 'glass-panel' : 'bg-white border border-gray-200'}`}>
              {stage === 'IDLE' ? (
                <div className={`h-full border border-dashed rounded flex items-center justify-center ${isDarkMode ? 'border-white/10 text-zinc-500' : 'border-gray-300 text-gray-500'}`}>
                  <p>Run analysis to see skills extraction</p>
                </div>
              ) : analysis ? (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className={`text-sm font-medium tracking-wide uppercase ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        Analysis Complete
                      </span>
                    </div>
                    <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {analysis.complexityScore}<span className={`text-sm font-normal ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>/100 Impact</span>
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-sm font-semibold mb-3 uppercase tracking-wider ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Detected Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.technicalSkills.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                      {analysis.softSkills.map((skill, i) => (
                        <span key={i} className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-sm font-semibold mb-3 uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                      <AlertCircle className="w-4 h-4 text-orange-400" />
                      Growth Areas
                    </h3>
                    <ul className="space-y-2">
                      {analysis.improvementAreas.map((area, i) => (
                        <li key={i} className={`text-sm flex items-start gap-2 ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                          <span className="block w-1 h-1 mt-2 bg-orange-400 rounded-full flex-shrink-0" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`rounded-lg p-5 border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                    <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      Recommended Learning Path
                    </h3>
                    <div className="space-y-4">
                      {analysis.suggestedCourses.map((course, i) => (
                        <div key={i} className="group cursor-pointer">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-white group-hover:text-emerald-400' : 'text-gray-900 group-hover:text-emerald-600'}`}>{course.title}</span>
                            <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${isDarkMode ? 'bg-white/10 text-zinc-400' : 'bg-gray-200 text-gray-600'}`}>{course.platform}</span>
                          </div>
                          <p className={`text-xs mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>{course.reason}</p>
                          <div className={`w-full h-px group-last:hidden ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`} />
                        </div>
                      ))}
                    </div>
                    <button className={`w-full mt-4 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                      Start Learning Plan <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 ${isDarkMode ? 'text-blue-500' : 'text-blue-600'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                      {stage === 'READING_COMMITS' && 'Reading commits...'}
                      {stage === 'ANALYZING_PATTERNS' && 'Analyzing patterns...'}
                      {stage === 'GENERATING_PATH' && 'Generating learning path...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Auth Section */}
      <section id="auth-section" className={`py-24 relative overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] pointer-events-none ${isDarkMode ? 'from-blue-900/20 via-[#0a0a0a] to-[#0a0a0a]' : 'from-blue-500/10 via-gray-50 to-gray-50'}`} />
        
        <div className="max-w-md mx-auto px-6 relative">
          <div className={`rounded-2xl p-8 shadow-2xl transition-all ${isDarkMode ? 'glass-panel hover:bg-white/10' : 'bg-white border border-gray-200 hover:shadow-3xl'}`}>
            <div className="text-center mb-8">
              <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {isLoginMode ? 'Welcome Back!' : 'Join Origin'}
              </h2>
              <p className={isDarkMode ? 'text-zinc-400' : 'text-gray-600'}>
                {isLoginMode 
                  ? 'Sign in to discover amazing opportunities' 
                  : 'Start collaborating on incredible projects'
                }
              </p>
              {!isLoginMode && (
                <p className="text-sm text-blue-400 mt-2">
                  💡 You can complete your profile later in settings
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLoginMode && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required={!isLoginMode}
                    className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode ? 'bg-white/10 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode ? 'bg-white/10 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode ? 'bg-white/10 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                  placeholder="Enter your password"
                />
              </div>

              {!isLoginMode && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={!isLoginMode}
                    className={`w-full px-4 py-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isDarkMode ? 'bg-white/10 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    placeholder="Confirm your password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    {isLoginMode ? 'Signing In...' : 'Creating Account...'}
                  </>
                ) : (
                  isLoginMode ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className={isDarkMode ? 'text-zinc-400' : 'text-gray-600'}>
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
                  }}
                  className="ml-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  {isLoginMode ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-24 relative overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <div className={`absolute inset-0 bg-gradient-to-b pointer-events-none ${isDarkMode ? 'from-[#0a0a0a] to-blue-900/10' : 'from-white to-blue-500/5'}`} />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className={`text-4xl md:text-5xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Ready to transform your career?</h2>
          <p className={`text-lg mb-10 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
            Join 50,000+ developers who are letting their code speak for itself. 
            No cover letters. No resume parsing. Just pure skill matching.
          </p>
          <button 
            onClick={() => {
              setIsLoginMode(false);
              scrollToAuth();
            }}
            className={`h-14 px-10 rounded-full text-lg font-semibold hover:scale-105 transition-transform ${isDarkMode ? 'bg-white text-black shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]' : 'bg-gray-900 text-white shadow-[0_0_40px_-10px_rgba(0,0,0,0.3)]'}`}
          >
            Build Your Profile Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 border-t transition-colors ${isDarkMode ? 'border-white/5 bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-white' : 'bg-gray-900'}`}>
              <GitCommit className={`w-3 h-3 ${isDarkMode ? 'text-black' : 'text-white'}`} />
            </div>
            <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>origin</span>
          </div>
          
          <div className={`flex items-center space-x-6 text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
            <a href="#" className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}>Privacy</a>
            <a href="#" className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}>Terms</a>
            <a href="#" className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}>Twitter</a>
            <a href="#" className={`transition-colors ${isDarkMode ? 'hover:text-white' : 'hover:text-gray-900'}`}>GitHub</a>
          </div>
          
          <div className={`mt-4 md:mt-0 text-xs ${isDarkMode ? 'text-white/20' : 'text-gray-400'}`}>
            © 2024 Origin AI Inc.
          </div>
        </div>
      </footer>
    </div>
  );
};
