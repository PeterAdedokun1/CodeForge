import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, User, Settings, Stethoscope, AlertTriangle, Heart, WifiOff, LogOut, ChevronDown } from 'lucide-react';
import { HomePage } from '../pages/HomePage';
import { ProfilePage } from '../pages/ProfilePage';
import { CHEWPage } from '../pages/CHEWPage';
import { HospitalPage } from '../pages/HospitalPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LoginPage } from '../pages/LoginPage';
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
    { path: '/', icon: <Home className="w-6 h-6" />, label: 'MIMI' },
    { path: '/profile', icon: <User className="w-6 h-6" />, label: 'My Health' },
    { path: '/settings', icon: <Settings className="w-6 h-6" />, label: 'Settings' }
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

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive
                    ? 'text-pink-500'
                    : 'text-gray-500 hover:text-pink-400'
                  }`}
              >
                {item.icon}
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-full shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800">MIMI</h1>
              <p className="text-xs text-gray-400">Maternal Intelligence AI</p>
            </div>
          </div>

          {isLoggedIn && currentUser && (
            <div className="mt-4 bg-pink-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800">{currentUser.name}</p>
              {currentUser.gestationalWeek && (
                <p className="text-xs text-pink-600">Week {currentUser.gestationalWeek} • {currentUser.location || 'Nigeria'}</p>
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
                    : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          {/* Role Switcher (Demo Feature) */}
          <div className="relative">
            <button
              onClick={() => setShowRolePicker(!showRolePicker)}
              className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-xl text-sm font-medium text-purple-700 transition-colors"
            >
              <span>{roleLabels[role]}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showRolePicker ? 'rotate-180' : ''}`} />
            </button>
            {showRolePicker && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                {(['patient', 'chew', 'hospital'] as UserRole[]).map(r => (
                  <button
                    key={r}
                    onClick={() => { onRoleSwitch(r); setShowRolePicker(false); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-pink-50 transition-colors ${role === r ? 'bg-pink-50 text-pink-600 font-semibold' : 'text-gray-700'
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
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-500">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            {isLoggedIn && (
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    // Check if user is already logged in
    return !!getCurrentUser();
  });

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

  // For CHEW and hospital views, skip login
  useEffect(() => {
    if (role === 'chew' || role === 'hospital') {
      setIsLoggedIn(true);
    }
  }, [role]);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    clearSession();
    setIsLoggedIn(false);
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setRole(newRole);
    // Navigate to role's home
    const paths: Record<UserRole, string> = {
      patient: '/',
      chew: '/chew',
      hospital: '/hospital'
    };
    window.location.href = paths[newRole];
  };

  // Show login for patient role if not logged in
  if (!isLoggedIn && role === 'patient') {
    return <LoginPage onLogin={handleLogin} />;
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

      <main className="flex-1 overflow-hidden">
        <Routes>
          {role === 'patient' && (
            <>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          {role === 'chew' && (
            <>
              <Route path="/" element={<CHEWPage />} />
              <Route path="/chew" element={<CHEWPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          {role === 'hospital' && (
            <>
              <Route path="/" element={<HospitalPage />} />
              <Route path="/hospital" element={<HospitalPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </>
          )}
          <Route path="*" element={role === 'patient' ? <HomePage /> : role === 'chew' ? <CHEWPage /> : <HospitalPage />} />
        </Routes>
      </main>
    </div>
  );
};

export const AppLayout = (props: AppLayoutProps) => {
  return (
    <BrowserRouter>
      <AppLayoutInner {...props} />
    </BrowserRouter>
  );
};
