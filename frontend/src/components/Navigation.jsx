import { 
  Compass, MessageSquare, Users, ClipboardList,
  GitCommit, User, Sun, Moon, LogOut, Briefcase
} from 'lucide-react';
import { useState, useRef } from 'react';

export const SideNav = ({ currentView, setView, currentUser, isDarkMode, toggleTheme, onLogout }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef(null);

  const handleNavigation = (viewId) => {
    if (isNavigating) return; // Prevent rapid clicks
    
    setIsNavigating(true);
    setView(viewId);
    
    // Clear any existing timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Re-enable after 300ms
    navigationTimeoutRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, 300);
  };

  const navItems = [
    { id: 'discover', icon: Compass, label: 'Discover' },
    { id: 'connections', icon: MessageSquare, label: 'Connections' },
    { id: 'applications', icon: ClipboardList, label: 'My Applications' },
    { id: 'searchTalent', icon: Users, label: 'Find Talent' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs' },
  ];

  return (
    <aside className="hidden md:flex w-20 hover:w-64 flex-col bg-[#0f0f11] border-r border-white/5 transition-all duration-300 group z-50 fixed left-0 top-0 bottom-0 overflow-hidden">
      <div className="h-16 flex items-center justify-center group-hover:justify-start group-hover:px-6 transition-all border-b border-white/5 shrink-0">
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0">
          <GitCommit className="w-5 h-5 text-black" />
        </div>
        <span className="ml-3 font-bold text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          origin
        </span>
      </div>

      <div className="flex-1 py-6 flex flex-col gap-2 overflow-y-auto">
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            disabled={isNavigating}
            className={`relative h-12 flex items-center px-6 transition-all duration-200 ${
              currentView === item.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            } disabled:opacity-50`}
          >
            {currentView === item.id && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] rounded-r-full" />
            )}
            <item.icon className={`w-5 h-5 shrink-0 ${currentView === item.id ? 'text-blue-400' : ''}`} />
            <span className={`ml-4 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-4 group-hover:translate-x-0 ${
              currentView === item.id ? 'text-white' : ''
            }`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-white/5 shrink-0 space-y-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 p-2 rounded-xl w-full transition-colors hover:bg-white/5"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-zinc-400 shrink-0" /> : <Moon className="w-5 h-5 text-zinc-400 shrink-0" />}
          <span className="text-sm font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="flex items-center gap-3 p-2 rounded-xl w-full transition-colors hover:bg-white/5 group/logout"
          title="Logout"
        >
          <LogOut className="w-5 h-5 text-zinc-400 shrink-0 group-hover/logout:text-red-400 transition-colors" />
          <span className="text-sm font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap group-hover/logout:text-red-400">
            Logout
          </span>
        </button>

        {/* Profile */}
        <button 
          onClick={() => handleNavigation('profile')}
          disabled={isNavigating}
          className={`flex items-center gap-3 p-2 rounded-xl w-full transition-colors ${
            currentView === 'profile' || currentView === 'profileEdit' ? 'bg-white/10' : 'hover:bg-white/5'
          } disabled:opacity-50`}
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 border border-white/20 shrink-0" />
            {/* Notification Dot */}
            {currentUser?.analysis_notification && (
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0f0f11] animate-pulse" />
            )}
          </div>
          <div className="text-left opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
            <div className="text-sm font-bold text-white">{currentUser?.name || 'User'}</div>
            <div className="text-xs text-zinc-500">{currentUser?.role || 'Developer'}</div>
          </div>
        </button>
      </div>
    </aside>
  );
};

// Bottom Nav for Mobile
export const BottomNav = ({ currentView, setView, currentUser }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef(null);

  const handleNavigation = (viewId) => {
    if (isNavigating) return; // Prevent rapid clicks
    
    setIsNavigating(true);
    setView(viewId);
    
    // Clear any existing timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    // Re-enable after 300ms
    navigationTimeoutRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, 300);
  };

  const navItems = [
    { id: 'discover', icon: Compass, label: 'Discover' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs' },
    { id: 'connections', icon: MessageSquare, label: 'Connections' },
    { id: 'applications', icon: ClipboardList, label: 'Apps' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f0f11]/95 backdrop-blur-lg border-t border-white/5 z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.id)}
            disabled={isNavigating}
            className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              currentView === item.id 
                ? 'text-blue-400 bg-white/10' 
                : 'text-zinc-500 hover:text-zinc-300'
            } disabled:opacity-50`}
          >
            <item.icon className="w-6 h-6" />
            {/* Notification Dot for Profile */}
            {item.id === 'profile' && currentUser?.analysis_notification && (
              <div className="absolute top-1 right-3 w-2 h-2 bg-red-500 rounded-full border border-[#0f0f11] animate-pulse" />
            )}
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

// Legacy export for backward compatibility
export const Navigation = ({
  view,
  matchesCount,
  notificationsCount,
  onDiscover,
  onMatches,
  onPostProject,
  onMyProjects,
  onProjectLikes,
  onRequirements,
  onSearchTalent,
  currentUser,
  onProfileEdit
}) => (
  <nav className="bg-[#0f0f11] px-6 py-4 border-b border-white/5 shadow-sm">
    {/* Profile Completion Prompt */}
    {currentUser && (!currentUser.skills || currentUser.skills.length === 0) && (
      <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-center">
        <p className="text-sm text-blue-300">
          💡 <strong>Complete your profile</strong> to get better project matches! 
          <button 
            onClick={onProfileEdit}
            className="ml-2 text-blue-400 underline hover:text-blue-300"
          >
            Add your skills
          </button>
        </p>
      </div>
    )}
    
    <div className="flex justify-center gap-4 flex-wrap">
      {[
        { name: "Discover", key: "discover", onClick: onDiscover },
        { name: `Matches (${matchesCount})`, key: "matches", onClick: onMatches },
        { name: "Post Project", key: "postProject", onClick: onPostProject },
        { name: "My Projects", key: "myProjects", onClick: onMyProjects },
        { name: "Project Likes", key: "projectLikes", onClick: onProjectLikes },
        { name: "Find Collaborators", key: "requirements", onClick: onRequirements },
        { name: "Search Talent", key: "searchTalent", onClick: onSearchTalent }
      ].map((item) => (
        <button
          key={item.key}
          onClick={item.onClick}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 border ${
            view === item.key
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:border-white/20"
          }`}
        >
          {item.name}
          {item.key === "matches" && notificationsCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {notificationsCount}
            </span>
          )}
        </button>
      ))}
    </div>
  </nav>
);
