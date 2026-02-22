import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Mic, User, LayoutGrid, Bell, Settings, Stethoscope, AlertTriangle, Heart, WifiOff, LogOut, ChevronDown } from 'lucide-react';
import { HomePage } from '../pages/HomePage';
import { ProfilePage } from '../pages/ProfilePage';
import { CHEWPage } from '../pages/CHEWPage';
import { HospitalPage } from '../pages/HospitalPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { SignUpPage } from '../pages/SignUpPage';
import { getCurrentUser, clearSession } from '../lib/memoryStore';

type UserRole = 'patient' | 'chew' | 'hospital';

interface AppLayoutProps {
  initialRole?: UserRole;
}

const NavigationBar = ({
  role,
  isOnline,
  isLoggedIn,
  onRoleSwitch,
  onLogout
}: {
  role: UserRole;
  isOnline: boolean;
  isLoggedIn: boolean;
  onRoleSwitch: (role: UserRole) => void;
  onLogout: () => void;
}) => {
  const location = useLocation();
  const [showRolePicker, setShowRolePicker] = useState(false);
  const currentUser = getCurrentUser();

  const patientNavItems = [
    { path: '/dashboard', icon: <Mic className="w-6 h-6" />, label: 'MIMI' },
    { path: '/profile', icon: <User className="w-6 h-6" />, label: 'Profile' },
    { path: '/health', icon: <LayoutGrid className="w-6 h-6" />, label: 'Health' },
    { path: '/alerts', icon: <Bell className="w-6 h-6" />, label: 'Alerts' }
  ];

  const chewNavItems = [
    { path: '/chew', icon: <Stethoscope className="w-6 h-6" />, label: 'Patients' },
    { path: '/settings', icon: <Settings className="w-6 h-6" />, label: 'Settings' }
  ];

  const hospitalNavItems = [
    { path: '/hospital', icon: <AlertTriangle className="w-6 h-6" />, label: 'Alerts' },
    { path: '/settings', icon: <Settings className="w-6 h-6" />, label: 'Settings' }
  ];

  const navItems = role === 'patient' ? patientNavItems : role === 'chew' ? chewNavItems : hospitalNavItems;

  const roleLabels: Record<UserRole, string> = {
    patient: '👩 Patient',
    chew: '🏥 CHEW Worker',
    hospital: '🚑 Hospital'
  };

  return (
    <>
      {!isOnline && (
        <div className="bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center space-x-2">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode — Some features limited</span>
        </div>
      )}

      {/* Mobile bottom nav — dark themed */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 mimi-nav z-50 safe-bottom">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#2b1d24] border-r border-white/10 h-full">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">MIMI</h1>
              <p className="text-xs text-gray-500">Maternal Intelligence AI</p>
            </div>
          </div>

          {isLoggedIn && currentUser && (
            <div className="mt-4 bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-sm font-semibold text-white">{currentUser.name}</p>
              {currentUser.gestationalWeek && (
                <p className="text-xs text-pink-400">Week {currentUser.gestationalWeek} • {currentUser.location || 'Nigeria'}</p>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRolePicker(!showRolePicker)}
              className="w-full flex items-center justify-between px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 rounded-xl text-sm font-medium text-purple-300 transition-colors border border-purple-500/20"
            >
              <span>{roleLabels[role]}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showRolePicker ? 'rotate-180' : ''}`} />
            </button>
            {showRolePicker && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#36252d] rounded-xl shadow-xl border border-white/10 overflow-hidden z-50">
                {(['patient', 'chew', 'hospital'] as UserRole[]).map(r => (
                  <button
                    key={r}
                    onClick={() => { onRoleSwitch(r); setShowRolePicker(false); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition-colors ${role === r ? 'bg-pink-900/20 text-pink-400 font-semibold' : 'text-gray-300'
                      }`}
                  >
                    {roleLabels[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-500">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            {isLoggedIn && (
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>Switch User</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

const AppLayoutInner = ({ initialRole = 'patient' }: AppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return !!getCurrentUser();
  });

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup', '/forgot-password'];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (role === 'chew' || role === 'hospital') {
      setIsLoggedIn(true);
    }
  }, [role]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    navigate('/dashboard');
  };

  const handleSignUp = () => {
    setIsLoggedIn(true);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    clearSession();
    setIsLoggedIn(false);
    navigate('/');
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setRole(newRole);
    const paths: Record<UserRole, string> = {
      patient: '/dashboard',
      chew: '/chew',
      hospital: '/hospital'
    };
    navigate(paths[newRole]);
  };

  // Show public pages (Landing, Login, Signup) without navigation
  if (isPublicRoute && !isLoggedIn) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/signup" element={<SignUpPage onSignUp={handleSignUp} />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }

  // Redirect to dashboard if logged in and trying to access public routes
  if (isPublicRoute && isLoggedIn) {
    return (
      <Routes>
        <Route path="*" element={<DashboardRedirect role={role} />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <NavigationBar
        role={role}
        isOnline={isOnline}
        isLoggedIn={isLoggedIn}
        onRoleSwitch={handleRoleSwitch}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-hidden pb-16 md:pb-0">
        <Routes>
          {role === 'patient' && (
            <>
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/health" element={<SettingsPage />} />
              <Route path="/alerts" element={<HospitalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          {role === 'chew' && (
            <>
              <Route path="/dashboard" element={<CHEWPage />} />
              <Route path="/chew" element={<CHEWPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          {role === 'hospital' && (
            <>
              <Route path="/dashboard" element={<HospitalPage />} />
              <Route path="/hospital" element={<HospitalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          <Route path="*" element={<DashboardRedirect role={role} />} />
        </Routes>
      </main>
    </div>
  );
};

// Helper component to redirect to appropriate dashboard
const DashboardRedirect = ({ role }: { role: UserRole }) => {
  const navigate = useNavigate();
  useEffect(() => {
    const paths: Record<UserRole, string> = {
      patient: '/dashboard',
      chew: '/chew',
      hospital: '/hospital'
    };
    navigate(paths[role], { replace: true });
  }, [role, navigate]);
  return null;
};

export const AppLayout = (props: AppLayoutProps) => {
  return (
    <BrowserRouter>
      <AppLayoutInner {...props} />
    </BrowserRouter>
  );
};
