import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getResults } from '../api/client';
import NarrativePanel from './NarrativePanel';
import ChartGrid from './ChartGrid';
import DataPreview from './DataPreview';
import ExportPanel from './ExportPanel';
import './Dashboard.css';

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

  useEffect(() => {
    // Fetch results on mount
    getResults(sessionId).then(data => {
      setResults(data);
      setLoading(false);
    }).catch(err => { 
      setError(err.message || 'Failed to fetch results'); 
      setLoading(false); 
    });
  }, [sessionId]);

  if (loading) return <div className="dashboard-loading">Loading results...</div>;
  if (error) return <div className="dashboard-error">{error}</div>;
  if (!results) return null;

  const { session, stats, narrative, charts, data_preview } = results;
  
  // Compute KPI values from stats
  const kpis = [
    { label: 'Total Rows', value: session?.row_count || 0, sub: 'records analyzed' },
    { label: 'Columns', value: session?.col_count || 0, sub: `${charts?.length || 0} charts generated` },
    { label: 'Outliers Detected', value: computeOutlierCount(stats), sub: 'across all columns' },
    { label: 'Correlations', value: stats?.top_correlations?.length || 0, sub: 'significant pairs' },
  ];

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
            <div className="kpi-card-value">
              <CountUp target={kpi.value} />
            </div>
            <div className="kpi-card-sub">{kpi.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="tab-bar">
        {['overview', 'charts', 'data', 'export'].map(tab => (
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
                  {NarrativePanel ? <NarrativePanel narrative={narrative} /> : <div>NarrativePanel placeholder</div>}
                </div>
                <div className="overview-charts">
                  {ChartGrid ? <ChartGrid charts={charts?.slice(0, 4) || []} /> : <div>ChartGrid placeholder</div>}
                </div>
              </div>
            )}
            {activeTab === 'charts' && (ChartGrid ? <ChartGrid charts={charts || []} /> : <div>ChartGrid placeholder</div>)}
            {activeTab === 'data' && (DataPreview ? <DataPreview data={data_preview} session={session} /> : <div>DataPreview placeholder</div>)}
            {activeTab === 'export' && (ExportPanel ? <ExportPanel sessionId={sessionId} filename={filename} /> : <div>ExportPanel placeholder</div>)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Dashboard;
