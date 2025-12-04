import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, CheckSquare, Calendar, X, History, LogOut, Clock, AlertTriangle, GitMerge } from 'lucide-react';


import classNames from 'classnames';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, companyName }) => {
  const location = useLocation();
  const { logout, isAuthenticated } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showWarning, setShowWarning] = useState(false);

  // Cookie utility function
  const getCookie = (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  // Update session time remaining
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateTimeRemaining = () => {
      const sessionData = getCookie('sales_auth_session');
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          const now = Date.now();
          const sessionDuration = 3 * 24 * 60 * 60 * 1000; // 3 days
          const remaining = session.timestamp + sessionDuration - now;

          setTimeRemaining(Math.max(0, remaining));

          // Show warning when less than 1 hour remaining
          setShowWarning(remaining < 60 * 60 * 1000);
        } catch (error) {
          setTimeRemaining(0);
        }
      }
    };

    // Update immediately
    updateTimeRemaining();

    // Update every minute
    const interval = setInterval(updateTimeRemaining, 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return 'Expired';

    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { name: 'Pipelines', icon: <GitMerge size={18} />, path: '/pipelines' },
    { name: 'Contacts', icon: <Users size={18} />, path: '/leads' },
    { name: 'Tasks', icon: <CheckSquare size={18} />, path: '/tasks' },
    { name: 'Tasks Calendar', icon: <Calendar size={18} />, path: '/calendar' },
    { name: 'Activities', icon: <History size={18} />, path: '/activities' },
  ];

  return (
    <div
      className={classNames(
        'fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0',
        {
          'translate-x-0': isOpen,
          '-translate-x-full': !isOpen
        }
      )}
    >
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-xl font-bold text-blue-800">{companyName}</h1>
        <button
          onClick={onClose}
          className="md:hidden rounded-full p-1 hover:bg-gray-100"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="mt-4 px-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={classNames(
              'sidebar-item',
              location.pathname === item.path
                ? 'sidebar-item-active'
                : 'sidebar-item-inactive'
            )}
          >
            <span className="mr-3">{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="absolute bottom-0 w-full p-4 border-t bg-gray-50">
        {/* Session Status */}
        {isAuthenticated && timeRemaining > 0 && (
          <div className={`mb-3 p-2 rounded-lg text-xs ${showWarning
            ? 'bg-orange-100 border border-orange-300 text-orange-800'
            : 'bg-blue-100 border border-blue-300 text-blue-800'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {showWarning ? (
                  <AlertTriangle size={12} className="mr-1" />
                ) : (
                  <Clock size={12} className="mr-1" />
                )}
                <span className="font-medium">Session: {formatTimeRemaining(timeRemaining)}</span>
              </div>
            </div>
          </div>
        )}

        {/* App Info and Logout */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-800 flex items-center justify-center text-white font-bold">
              {companyName[0]}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">Real Estate CRM</p>
              <p className="text-xs text-gray-500">v1.0.0</p>
            </div>
          </div>

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200 focus:outline-none transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;