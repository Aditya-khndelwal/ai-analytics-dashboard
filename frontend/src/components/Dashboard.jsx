import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getResults, createShareLink } from '../api/client';
import NarrativePanel from './NarrativePanel';
import ChartGrid from './ChartGrid';
import DataPreview from './DataPreview';
import ExportPanel from './ExportPanel';
import ChatPanel from './ChatPanel';
import CustomChart from './CustomChart';
import './Dashboard.css';
import './ChatPanel.css';

function CountUp({ target, duration = 1000 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const num = parseInt(String(target).replace(/,/g, ''), 10);
    if (isNaN(num)) { setCount(target); return; }
    let start = 0;
    const step = num / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setCount(num.toLocaleString()); clearInterval(timer); }
      else setCount(Math.floor(start).toLocaleString());
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count}</>;
}

function computeOutlierCount(stats) {
  if (!stats || !stats.outliers) return 0;
  return Object.values(stats.outliers).reduce((sum, count) => sum + count, 0);
}

function Dashboard({ sessionId, filename, activeTab, onTabChange }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    getResults(sessionId).then(data => {
      setResults(data);
      setLoading(false);
    }).catch(err => { 
      setError(err.message || 'Failed to fetch results'); 
      setLoading(false); 
    });
  }, [sessionId]);

  const handleShare = async () => {
    try {
      const data = await createShareLink(sessionId);
      const baseUrl = window.location.origin;
      setShareUrl(`${baseUrl}/shared/${data.token}`);
      setShareModal(true);
      setShareCopied(false);
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  if (loading) return <div className="dashboard-loading">Loading results...</div>;
  if (error) return <div className="dashboard-error">{error}</div>;
  if (!results) return null;

  const { session, stats, narrative, charts, data_preview } = results;
  
  const kpis = [
    { label: 'Total Rows', value: session?.row_count || 0, sub: 'records analyzed' },
    { label: 'Columns', value: session?.col_count || 0, sub: `${charts?.length || 0} charts generated` },
    { label: 'Outliers Detected', value: computeOutlierCount(stats), sub: 'across all columns' },
    { label: 'Correlations', value: stats?.top_correlations?.length || 0, sub: 'significant pairs' },
  ];

  // Compute data quality score from missing data percentage
  const missingPct = stats?.summary?.total_missing_pct || 0;
  const qualityScore = Math.max(0, Math.round(100 - missingPct));
  const qualityLabel = qualityScore >= 90 ? 'Excellent' : qualityScore >= 70 ? 'Good' : qualityScore >= 50 ? 'Fair' : 'Poor';
  const qualityColor = qualityScore >= 90 ? 'var(--success-text)' : qualityScore >= 70 ? 'var(--accent)' : 'var(--error-text)';

  kpis.push({ label: 'Data Quality', value: qualityScore, sub: qualityLabel, suffix: '%', color: qualityColor });

  return (
    <div className="dashboard">
      {/* Top Bar */}
      <motion.div 
        className="top-bar"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="top-bar-title">{filename}</h1>
        <div className="top-bar-meta">
          <span className="meta-badge">{session?.row_count?.toLocaleString() || 0} rows</span>
          <span className="meta-badge">{session?.col_count || 0} cols</span>
          <button className="btn-ghost share-btn" onClick={handleShare} title="Share Dashboard">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((kpi, i) => (
          <motion.div 
            className="kpi-card" 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' }}
            whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
          >
            <div className="kpi-card-label">{kpi.label}</div>
            <div className="kpi-card-value" style={kpi.color ? { color: kpi.color } : {}}>
              <CountUp target={kpi.value} />{kpi.suffix || ''}
            </div>
            <div className="kpi-card-sub">{kpi.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="tab-bar">
        {['overview', 'charts', 'custom', 'data', 'export'].map(tab => (
          <button
            key={tab}
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content" style={{ position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ width: '100%' }}
          >
            {activeTab === 'overview' && (
              <div className="overview-grid">
                <div className="overview-narrative">
                  <NarrativePanel narrative={narrative} />
                </div>
                <div className="overview-charts">
                  <ChartGrid charts={charts?.slice(0, 4) || []} />
                </div>
              </div>
            )}
            {activeTab === 'charts' && <ChartGrid charts={charts || []} />}
            {activeTab === 'custom' && <CustomChart data={data_preview} session={session} />}
            {activeTab === 'data' && <DataPreview data={data_preview} session={session} />}
            {activeTab === 'export' && <ExportPanel sessionId={sessionId} filename={filename} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Ask AI Button */}
      <motion.button
        className="chat-fab"
        onClick={() => setChatOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title="Ask AI about your data"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </motion.button>

      {/* Chat Panel */}
      <ChatPanel sessionId={sessionId} isOpen={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Share Modal */}
      {shareModal && (
        <div className="share-modal-overlay" onClick={() => setShareModal(false)}>
          <motion.div
            className="share-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Share Dashboard</h3>
            <p>Anyone with this link can view your analysis results.</p>
            <div className="share-link-box">
              <input className="share-link-input" value={shareUrl} readOnly />
              <button className="share-copy-btn" onClick={handleCopyLink}>
                {shareCopied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <button className="share-modal-close" onClick={() => setShareModal(false)}>Close</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
