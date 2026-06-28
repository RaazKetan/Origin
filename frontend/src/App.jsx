import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { AuthForm } from './components/Authform';
import { Header } from './components/Header';
import { SideNav, BottomNav } from './components/Navigation';
import { AppShell } from './components/AppShell';
import { ChatView } from './components/ChatView';
import { UserDetails } from './components/UserDetails';
import { ProfileView } from './components/ProfileView';
import { RequirementsPage } from './components/RequirementsPage';
import { LandingPage } from './components/LandingPage';
import { TalentSearch } from './components/TalentSearch';
import { Discover } from './components/Discover';
import { ProfileSetup } from './components/ProfileSetup';
import { Jobs } from './components/Jobs';
import { ApplicationsTracker } from './components/ApplicationsTracker';
import { RepoReviews } from './components/RepoReviews';
import { AnimatedThemeToggler } from './components/magicui/animated-theme-toggler';
import { OAuthSetup } from './components/OAuthSetup';
import { ResetPassword } from './components/ResetPassword';
import { API_BASE } from './lib/api';
// GlobalAnalysisPopup retired — analysis runs inline during complete-profile.

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("login");
  const [inspectedUser, setInspectedUser] = useState(null);
  const [ownerUser, setOwnerUser] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [setupToken, setSetupToken] = useState(null);
  const [resetPasswordToken, setResetPasswordToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    if (window.location.pathname === '/reset-password') {
      return new URLSearchParams(window.location.search).get('token');
    }
    return null;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };


  const fetchConnections = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/my-connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setConnections(await res.json());
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  }, []);

  const checkProfileCompletion = async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      const res = await fetch(`${API_BASE}/profile-setup/check-completion`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        return data.profile_completed;
      }
      return false;
    } catch (error) {
      console.error('Error checking profile completion:', error);
      return false;
    }
  };

  const handleLogin = async (identifier, password) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Backend accepts {username, password} (username field can be either
        // a username or an email — backend resolves both).
        body: JSON.stringify({ username: identifier, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        await fetchCurrentUser();
        const isComplete = await checkProfileCompletion();
        setView(isComplete ? "discover" : "profileSetup");
      } else {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Incorrect username/email or password");
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error; // Let LandingPage display it inline (no alert popups)
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (name, email, password) => {
    setIsLoading(true);
    try {
      // Generate username from email (before @ symbol)
      const username = email.split('@')[0];
      
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username,
          name, 
          email, 
          password
        })
      });
  
      if (res.ok) {
        alert("Registration successful! Let's set up your profile.");
        // Auto-login after successful registration
        await handleLogin(email, password);
        // Will redirect to profile setup in checkProfileCompletion
      } else {
        const msg = await res.text();
        console.error("register error:", msg);
        alert(`Registration failed: ${msg}`);
      }
    } catch (error) {
      console.error("Registration error:", error);
      alert("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const openChat = async (project) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setSelectedProject(project);
    
    try {
      const res = await fetch(`${API_BASE}/chat/${project.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const messages = await res.json();
        setChatMessages(messages);
        
        // Determine who the other person is and fetch their details
        if (messages.length > 0) {
          // Find a message from someone other than current user
          const otherMessage = messages.find(msg => msg.from_user_id !== currentUser?.id);
          if (otherMessage) {
            try {
              const otherUserRes = await fetch(`${API_BASE}/users/${otherMessage.from_user_id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (otherUserRes.ok) {
                const otherUserData = await otherUserRes.json();
                setOwnerUser(otherUserData);
              }
            } catch (error) {
              console.error("Error fetching other user:", error);
            }
          } else {
            // If no other messages, use project owner
            try {
              const ownerRes = await fetch(`${API_BASE}/users/${project.owner_id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (ownerRes.ok) {
                const ownerData = await ownerRes.json();
                setOwnerUser(ownerData);
              }
            } catch (error) {
              console.error("Error fetching owner:", error);
            }
          }
        } else {
          // If no messages yet, use the project owner as the other person
          try {
            const ownerRes = await fetch(`${API_BASE}/users/${project.owner_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (ownerRes.ok) {
              const ownerData = await ownerRes.json();
              setOwnerUser(ownerData);
            }
          } catch (error) {
            console.error("Error fetching owner:", error);
          }
        }
        
        setView("chat");
        
        // Mark messages as read
        try {
          await fetch(`${API_BASE}/chat/${project.id}/mark-read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.error("Error marking messages as read:", error);
        }
      } else if (res.status === 403) {
        alert("You don't have permission to chat on this project. You need to like the project and be approved by the owner first.");
      } else {
        console.error("Failed to open chat:", await res.text());
        alert("Failed to open chat. Please try again.");
      }
    } catch (e) {
      console.error("chat open error:", e);
      alert("Error opening chat. Please try again.");
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedProject) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: selectedProject.id,
          to_user_id: selectedProject.owner_id,
          content: chatInput.trim()
        })
      });
      if (res.ok) {
        const msg = await res.json();
        setChatMessages((prev) => [...prev, msg]);
        setChatInput("");
      } else if (res.status === 403) {
        alert("You don't have permission to send messages on this project.");
      } else {
        console.error("Failed to send message:", await res.text());
        alert("Failed to send message. Please try again.");
      }
    } catch (e) {
      console.error("send chat error:", e);
      alert("Error sending message. Please try again.");
    }
  };

  const viewOwner = async (ownerId) => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE}/users/${ownerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const u = await r.json();
        setInspectedUser(u);
        setView("userDetails");
      }
    } catch (err) { console.error(err); }
  };

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        localStorage.removeItem("token");
        setCurrentUser(null);
        return false;
      }
      const user = await res.json();
      setCurrentUser(user);
      return true;
    } catch { return false; }
  };
  
  useEffect(() => {
    (async () => {
      // Check for OAuth tokens in URL first
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const urlSetupToken = params.get("setup_token");
      const errorMsg = params.get("error");

      if (errorMsg) {
        alert("Authentication failed. Please try again.");
        window.history.replaceState({}, document.title, "/");
        setView("login");
        return;
      }

      if (token) {
        localStorage.setItem("token", token);
        window.history.replaceState({}, document.title, "/");
      } else if (urlSetupToken) {
        setSetupToken(urlSetupToken);
        window.history.replaceState({}, document.title, "/");
        setView("oauthSetup");
        return;
      }

      let ok = await fetchCurrentUser();

      // Dev auto-login: skip the login/signup/profile-setup grind every reload.
      // Only fires when (a) Vite is in DEV, (b) no token already, (c) the env
      // var is set. Production builds are inert.
      // To enable: set VITE_DEV_AUTOLOGIN_USER + VITE_DEV_AUTOLOGIN_PASS in
      // frontend/.env.local — see env.example.
      if (!ok && import.meta.env.DEV && import.meta.env.VITE_DEV_AUTOLOGIN_USER) {
        try {
          const r = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: import.meta.env.VITE_DEV_AUTOLOGIN_USER,
              password: import.meta.env.VITE_DEV_AUTOLOGIN_PASS || "DevPass1234",
            }),
          });
          if (r.ok) {
            const d = await r.json();
            localStorage.setItem("token", d.access_token);
            ok = await fetchCurrentUser();
            console.info(`[dev-autologin] signed in as ${import.meta.env.VITE_DEV_AUTOLOGIN_USER}`);
          } else {
            console.warn("[dev-autologin] login failed", r.status, await r.text());
          }
        } catch (e) {
          console.warn("[dev-autologin] error", e);
        }
      }

      if (ok) {
        const isComplete = await checkProfileCompletion();
        setView(isComplete ? "discover" : "profileSetup");
      } else {
        setView("login");
      }
    })();
  }, []);





  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setConnections([]);
    setView("login");
  };

  const performSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/ai/search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          query: query,
          filters: {}
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        setSearchSuggestions(data.suggestions || []);
      } else {
        console.error("Search failed:", await response.text());
        setSearchResults([]);
        setSearchSuggestions([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setSearchSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  };




  // Global theme toggle — fixed top-right, visible on every page.
  // Pre-auth + profile-setup pages don't have AppShell, so this is the only
  // toggle they see. On the dashboard, AppShell's topbar toggle still appears,
  // but this fixed widget is above it. ponytail: one source, every page.
  const themeToggle = (
    <div className="fixed top-4 right-4 z-50">
      <AnimatedThemeToggler
        theme={isDarkMode ? 'dark' : 'light'}
        onThemeChange={() => toggleTheme()}
        variant="circle"
        fromCenter
        className="w-9 h-9 grid place-items-center rounded-md text-origin-ink-2 bg-origin-bg-soft/80 backdrop-blur border border-origin-line hover:bg-origin-surface hover:text-origin-ink transition-colors cursor-pointer [&>svg]:w-[18px] [&>svg]:h-[18px]"
      />
    </div>
  );

  // Password-reset deep link — handled before anything else so the user
  // doesn't have to log in to use the link from their email.
  if (resetPasswordToken && !currentUser) {
    return (
      <>{themeToggle}<ResetPassword
        token={resetPasswordToken}
        onSuccess={async () => {
          setResetPasswordToken(null);
          await fetchCurrentUser();
          const complete = await checkProfileCompletion();
          setView(complete ? "discover" : "profileSetup");
        }}
      /></>
    );
  }

  if (!currentUser) {
    if (view === "oauthSetup" && setupToken) {
      return (
        <>{themeToggle}<OAuthSetup
          setupToken={setupToken}
          onComplete={async (token) => {
            localStorage.setItem("token", token);
            setSetupToken(null);
            await fetchCurrentUser();
            setView("profileSetup");
          }}
        /></>
      );
    }
    return (
      <>{themeToggle}<LandingPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={isLoading}
      /></>
    );
  }

  // Show profile setup if not completed
  if (view === "profileSetup") {
    return (
      <>{themeToggle}<ProfileSetup
        onComplete={async () => {
          await fetchCurrentUser();
          setView("discover");
        }}
        isDarkMode={isDarkMode}
      /></>
    );
  }

  const crumbForView = {
    discover: <>DISCOVER / <b className="text-origin-ink font-medium normal-case tracking-tight">Projects</b></>,
    jobs: <>JOBS / <b className="text-origin-ink font-medium normal-case tracking-tight">For you</b></>,
    connections: <>CONNECTIONS / <b className="text-origin-ink font-medium normal-case tracking-tight">All</b></>,
    applications: <>APPLICATIONS / <b className="text-origin-ink font-medium normal-case tracking-tight">Pipeline</b></>,
    talent: <>FIND TALENT / <b className="text-origin-ink font-medium normal-case tracking-tight">Search</b></>,
    profile: <>PROFILE / <b className="text-origin-ink font-medium normal-case tracking-tight">{currentUser?.name || currentUser?.username}</b></>,
    repoReviews: <>AGENT / <b className="text-origin-ink font-medium normal-case tracking-tight">Repo Reviews</b></>,
    requirements: <>DISCOVER / <b className="text-origin-ink font-medium normal-case tracking-tight">Find candidates</b></>,
    chat: <>CONNECTIONS / <b className="text-origin-ink font-medium normal-case tracking-tight">Chat</b></>,
    userDetails: <>PROFILE / <b className="text-origin-ink font-medium normal-case tracking-tight">{inspectedUser?.name || '—'}</b></>,
  }[view] || null;

  return (
    <AppShell
      currentView={view}
      onNavigate={(newView) => {
        setView(newView);
        if (newView === 'connections') fetchConnections();
      }}
      currentUser={currentUser}
      onLogout={handleLogout}
      crumb={crumbForView}
      counts={{ saved: 0, messages: connections.length || null, signal: currentUser?.portfolio_score }}
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
    >
      {/* Legacy page bodies — each will be ported to use the design directly */}
      <div className="w-full">
        {view === "discover" && (
          /* Discover and Jobs both surface the matched-jobs feed; same UI. */
          <Jobs />
        )}

        {view === "jobs" && (
          <Jobs />
        )}

        {view === "connections" && (
          <div className="w-full max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                <span className="bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">Your</span> Connections
              </h1>
              <p className={`text-base ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                Recruiters and employers who responded to your applications.
              </p>
            </div>
            {connections.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connections.map(conn => (
                  <div key={conn.id} className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-gray-100 dark:border-white/5 p-5 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                        {(conn.employer_name || 'C')[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{conn.employer_name || 'Recruiter'}</h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-500">{conn.employer_org_name || 'Company'}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-zinc-300 mb-2">Applied to: <span className="font-semibold">{conn.job_title}</span></p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      conn.status === 'accepted' ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                        : conn.status === 'interview' ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300'
                        : conn.status === 'reviewed' ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                        : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'
                    }`}>
                      {conn.status.charAt(0).toUpperCase() + conn.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-center py-16 bg-white dark:bg-[#1a1a1c] rounded-3xl border border-gray-100 dark:border-white/5`}>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">No connections yet</p>
                <p className={`text-sm ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                  When recruiters respond to your applications, they'll appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {view === "applications" && (
          <ApplicationsTracker />
        )}

        {view === "repoReviews" && (
          <RepoReviews />
        )}

        {view === "chat" && selectedProject && (
          <ChatView 
            selectedProject={selectedProject}
            chatMessages={chatMessages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={sendChat}
            onBack={() => setView("connections")}
            currentUser={currentUser}
            otherPerson={ownerUser}
          />
        )}

        {view === "userDetails" && inspectedUser && (
          <UserDetails 
            user={inspectedUser}
            onBack={() => setView("connections")}
            isDarkMode={isDarkMode}
          />
        )}

        {view === "profile" && (
          <ProfileView 
            currentUser={currentUser}
            onBack={() => setView("discover")}
            isDarkMode={isDarkMode}
          />
        )}

        {view === "requirements" && (
          <RequirementsPage 
            onBack={() => setView("discover")}
            onGetRecommendations={(user, isMessage = false) => {
              if (isMessage) {
                // Find a project to message about
                const userProject = myProjects.find(p => p.owner_id === user.id);
                if (userProject) {
                  openChat(userProject);
                } else {
                  alert("No project found to message about");
                }
              } else {
                setInspectedUser(user);
                setView("userDetails");
              }
            }}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Find Talent hidden until we add the recruiter flow */}
        {false && view === "searchTalent" && (
          <TalentSearch />
        )}
      </div>

    </AppShell>
  );
}

export default App;