import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { AuthForm } from './components/Authform';
import { Header } from './components/Header';
import { SideNav, BottomNav } from './components/Navigation';
import { ChatView } from './components/ChatView';
import { UserDetails } from './components/UserDetails';
import { ProfileView } from './components/ProfileView';
import { RequirementsPage } from './components/RequirementsPage';
import { ProfileEdit } from './components/ProfileEdit';
import { LandingPage } from './components/LandingPage';
import { TalentSearch } from './components/TalentSearch';
import { Discover } from './components/Discover';
import { ProfileSetup } from './components/ProfileSetup';
import { Jobs } from './components/Jobs';
import { ApplicationsTracker } from './components/ApplicationsTracker';
const API_BASE = "http://localhost:8000";

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("login");
  const [inspectedUser, setInspectedUser] = useState(null);
  const [ownerUser, setOwnerUser] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [messageNotifications, setMessageNotifications] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [connections, setConnections] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });
  const isLoadingNotificationsRef = useRef(false);

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

  const fetchNotifications = useCallback(async () => {
    if (!currentUser || isLoadingNotificationsRef.current) return; // Prevent multiple simultaneous calls
    
    isLoadingNotificationsRef.current = true;
    
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE}/chat/notifications/${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        setNotifications(await r.json());
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      isLoadingNotificationsRef.current = false;
    }
  }, [currentUser]); // Only depend on currentUser

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

  const handleLogin = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.access_token);
        await fetchCurrentUser();
        
        // Check if profile is completed
        const isComplete = await checkProfileCompletion();
        if (isComplete) {
          setView("discover");
        } else {
          setView("profileSetup");
        }
      } else {
        alert("Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
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
    
    // Clear message notifications for this project
    setMessageNotifications(prev => {
      const newNotifications = { ...prev };
      delete newNotifications[project.id];
      return newNotifications;
    });
    
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
        
        // Show notification for the recipient
        const recipientId = selectedProject.owner_id === currentUser.id 
          ? ownerUser?.id 
          : selectedProject.owner_id;
        
        if (recipientId) {
          setMessageNotifications(prev => ({
            ...prev,
            [selectedProject.id]: (prev[selectedProject.id] || 0) + 1
          }));
        }
        
        // Refresh notifications after sending message
        await fetchNotifications();
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
      const r = await fetch(`${API_BASE}/users/${ownerId}`);
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
      const ok = await fetchCurrentUser();
      if (ok) {
        const isComplete = await checkProfileCompletion();
        if (isComplete) {
          setView("discover");
        } else {
          setView("profileSetup");
        }
      } else {
        setView("login");
      }
    })();
  }, []);

  // Refresh notifications periodically
  useEffect(() => {
    if (!currentUser) return;
    
    // Fetch notifications immediately when currentUser is set
    fetchNotifications();
    
    // Then set up the interval for periodic updates
    // Optimize: Poll every 30s instead of 10s, and only if tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchNotifications();
      }
    }, 30000); 
    
    return () => clearInterval(interval);
  }, [currentUser, fetchNotifications]);





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




  if (!currentUser) {
    return (
      <LandingPage 
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={isLoading}
      />
    );
  }

  // Show profile setup if not completed
  if (view === "profileSetup") {
    return (
      <ProfileSetup 
        onComplete={async () => {
          await fetchCurrentUser();
          setView("discover");
        }}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className={`min-h-screen font-sans flex ${isDarkMode ? 'bg-[#0a0a0a] text-slate-50' : 'bg-gray-50 text-gray-900'}`}>
      <SideNav 
        currentView={view} 
        setView={(newView) => {
          setView(newView);
          if (newView === 'connections') {
            fetchConnections();
          }
        }}
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <main className={`flex-1 md:ml-20 overflow-y-auto min-h-screen relative ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
        {/* Top mobile header */}
        <div className={`md:hidden h-16 flex items-center justify-between px-6 border-b ${isDarkMode ? 'border-white/5 bg-[#0f0f11]' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>origin</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={handleLogout}
              className={`text-sm transition-colors ${isDarkMode ? 'text-zinc-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="pb-24 md:pb-0 p-6 flex justify-center">
        {view === "discover" && (
          <Discover isDarkMode={isDarkMode} />
        )}

        {view === "jobs" && (
          <Jobs isDarkMode={isDarkMode} />
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
          <ApplicationsTracker isDarkMode={isDarkMode} />
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
            onEdit={() => setView("profileEdit")}
            isDarkMode={isDarkMode}
          />
        )}

        {view === "profileEdit" && (
          <ProfileEdit 
            currentUser={currentUser}
            onSave={(updatedUser) => {
              setCurrentUser(updatedUser);
              setView("profile");
            }}
            onBack={() => setView("profile")}
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

        {view === "searchTalent" && (
          <TalentSearch 
            onBack={() => setView("discover")}
            isDarkMode={isDarkMode}
          />
        )}
        </div>
      </main>
      
      <BottomNav currentView={view} setView={setView} currentUser={currentUser} />
    </div>
  );
}

export default App;