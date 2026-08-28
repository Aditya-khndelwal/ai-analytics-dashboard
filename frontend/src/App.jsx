import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingPage from './components/landing/LandingPage';
import FileUpload from './components/FileUpload';
import AnalysisProgress from './components/AnalysisProgress';
import Dashboard from './components/Dashboard';

function App() {
  const [appState, setAppState] = useState('landing'); // 'landing', 'upload', 'analyzing', 'dashboard'
  const [sessionId, setSessionId] = useState(null);
  const [filename, setFilename] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const handleNewAnalysis = () => {
    setAppState('landing');
    setSessionId(null);
    setFilename('');
    setActiveTab('overview');
  };

  const handleUploadComplete = (sid, fname) => {
    setSessionId(sid);
    setFilename(fname);
    setAppState('analyzing');
  };

  // ── Landing page: full-screen, no sidebar ──
  if (appState === 'landing') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <LandingPage onUploadComplete={handleUploadComplete} />
        </motion.div>
      </AnimatePresence>
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

        {/* Nav - only meaningful in dashboard state */}
        <nav className="sidebar-nav">
          {appState === 'dashboard' && (
            <>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                title="Overview"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className={`sidebar-nav-item ${activeTab === 'charts' ? 'active' : ''}`}
                onClick={() => setActiveTab('charts')}
                title="Charts"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                className={`sidebar-nav-item ${activeTab === 'data' ? 'active' : ''}`}
                onClick={() => setActiveTab('data')}
                title="Data"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '20px', height: '20px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3zM3 9h18M9 3v18" />
                </svg>
              </motion.button>
            </>
          )}
        </nav>

        {/* Bottom action */}
        <div className="sidebar-bottom">
          {appState === 'dashboard' && (
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleNewAnalysis} 
              className="sidebar-nav-item" 
              title="New Analysis"
            >
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
            <motion.div
              key="upload"
              initial={pageVariants.initial}
              animate={pageVariants.animate}
              exit={pageVariants.exit}
              transition={pageTransition}
              style={{ width: '100%', height: '100%' }}
            >
              <FileUpload onUploadComplete={handleUploadComplete} />
            </motion.div>
          )}
          {appState === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={pageVariants.initial}
              animate={pageVariants.animate}
              exit={pageVariants.exit}
              transition={pageTransition}
              style={{ width: '100%', height: '100%' }}
            >
              <AnalysisProgress 
                sessionId={sessionId} 
                onComplete={() => setAppState('dashboard')} 
              />
            </motion.div>
          )}
          {appState === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={pageVariants.initial}
              animate={pageVariants.animate}
              exit={pageVariants.exit}
              transition={pageTransition}
              style={{ width: '100%', height: '100%' }}
            >
              <Dashboard 
                sessionId={sessionId} 
                filename={filename} 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
