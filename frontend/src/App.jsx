import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingPage from './components/landing/LandingPage';
import FileUpload from './components/FileUpload';
import AnalysisProgress from './components/AnalysisProgress';
import Dashboard from './components/Dashboard';
import SharedDashboard from './components/SharedDashboard';
import CommandPalette from './components/CommandPalette';
import OnboardingTour from './components/OnboardingTour';

function App() {
  const [appState, setAppState] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  const [filename, setFilename] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [shareToken, setShareToken] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [cmdOpen, setCmdOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Check URL for shared routes on mount
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/shared\/([a-z0-9]+)$/i);
    if (match) {
      setShareToken(match[1]);
      setAppState('shared');
    }
  }, []);

  // ── Keyboard Shortcuts ──
  const handleKeyDown = useCallback((e) => {
    // Ctrl+K / Cmd+K — open command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setCmdOpen(prev => !prev);
      return;
    }

    // Don't trigger if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
      if (appState === 'dashboard') {
        // Could close modals — handled by individual components
      }
    }

    if (appState === 'dashboard') {
      if (e.key === '1') setActiveTab('overview');
      if (e.key === '2') setActiveTab('charts');
      if (e.key === '3') setActiveTab('data');
      if (e.key === '4') setActiveTab('export');
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNewAnalysis();
      }
    }
  }, [appState]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleNewAnalysis = () => {
    setAppState('landing');
    setSessionId(null);
    setFilename('');
    setActiveTab('overview');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  };

  const handleUploadComplete = (sid, fname) => {
    setSessionId(sid);
    setFilename(fname);
    setAppState('analyzing');
  };

  const handleSampleStart = (sid, fname) => {
    setSessionId(sid);
    setFilename(fname);
    setAppState('analyzing');
  };

  const handleCmdAction = (action, ...args) => {
    switch (action) {
      case 'new': handleNewAnalysis(); break;
      case 'home': handleNewAnalysis(); break;
      case 'tab': setActiveTab(args[0]); break;
      case 'theme': toggleTheme(); break;
      case 'load':
        setSessionId(args[0]);
        setFilename(args[1] || 'Dataset');
        setAppState('dashboard');
        setActiveTab('overview');
        break;
      default: break;
    }
  };

  // ── Shared dashboard: full-screen, no sidebar ──
  if (appState === 'shared' && shareToken) {
    return <SharedDashboard token={shareToken} />;
  }

  // ── Landing page: full-screen, no sidebar ──
  if (appState === 'landing') {
    return (
      <>
        <AnimatePresence mode="wait">
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <LandingPage
              onUploadComplete={handleUploadComplete}
              onSampleStart={handleSampleStart}
            />
          </motion.div>
        </AnimatePresence>
        <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmdAction} appState={appState} />
        <OnboardingTour />
      </>
    );
  }

  // ── App states with sidebar layout ──
  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -12 }
  };
  const pageTransition = { duration: 0.3, ease: 'easeOut' };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        {/* Logo */}
        <motion.div 
          className="sidebar-logo"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </motion.div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {appState === 'dashboard' && (
            <>
              <motion.button whileTap={{ scale: 0.95 }} className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} title="Overview (1)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} className={`sidebar-nav-item ${activeTab === 'charts' ? 'active' : ''}`} onClick={() => setActiveTab('charts')} title="Charts (2)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} className={`sidebar-nav-item ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')} title="Data (3)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3zM3 9h18M9 3v18" />
                </svg>
              </motion.button>
            </>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="sidebar-bottom">
          {/* Theme toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="sidebar-nav-item"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </motion.button>

          {appState === 'dashboard' && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleNewAnalysis} className="sidebar-nav-item" title="New Analysis (N)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </motion.button>
          )}
        </div>
      </aside>
      <main className="main-content">
        <AnimatePresence mode="wait">
          {appState === 'upload' && (
            <motion.div key="upload" initial={pageVariants.initial} animate={pageVariants.animate} exit={pageVariants.exit} transition={pageTransition} style={{ width: '100%', height: '100%' }}>
              <FileUpload onUploadComplete={handleUploadComplete} />
            </motion.div>
          )}
          {appState === 'analyzing' && (
            <motion.div key="analyzing" initial={pageVariants.initial} animate={pageVariants.animate} exit={pageVariants.exit} transition={pageTransition} style={{ width: '100%', height: '100%' }}>
              <AnalysisProgress sessionId={sessionId} onComplete={() => setAppState('dashboard')} />
            </motion.div>
          )}
          {appState === 'dashboard' && (
            <motion.div key="dashboard" initial={pageVariants.initial} animate={pageVariants.animate} exit={pageVariants.exit} transition={pageTransition} style={{ width: '100%', height: '100%' }}>
              <Dashboard sessionId={sessionId} filename={filename} activeTab={activeTab} onTabChange={setActiveTab} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmdAction} appState={appState} />
    </div>
  );
}

export default App;
