import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSharedResults } from '../api/client';
import NarrativePanel from './NarrativePanel';
import ChartGrid from './ChartGrid';
import './Dashboard.css';

function SharedDashboard({ token }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    getSharedResults(token)
      .then(data => { setResults(data); setLoading(false); })
      .catch(err => { setError(err.message || 'Shared link not found'); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
        Loading shared analysis...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif', gap: '12px' }}>
        <p style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Shared link not found</p>
        <p style={{ fontSize: '13px' }}>This link may have expired or is invalid.</p>
        <a href="/" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px' }}>← Go to Analytix AI</a>
      </div>
    );
  }

  if (!results) return null;

  const { session, stats, narrative, charts } = results;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Shared Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--accent-subtle)',
          border: '1px solid rgba(201,167,106,0.2)',
          borderRadius: '10px',
          padding: '12px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'var(--accent)' }}>
          📊 Shared Analysis — view only
        </span>
        <a href="/" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>
          Try Analytix AI →
        </a>
      </motion.div>

      {/* Title */}
      <motion.div
        className="top-bar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="top-bar-title">{session?.original_filename || 'Analysis'}</h1>
        <div className="top-bar-meta">
          <span className="meta-badge">{session?.row_count?.toLocaleString() || 0} rows</span>
          <span className="meta-badge">{session?.col_count || 0} cols</span>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="tab-bar">
        {['overview', 'charts'].map(tab => (
          <button
            key={tab}
            className={`tab-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="tab-content" style={{ position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default SharedDashboard;
