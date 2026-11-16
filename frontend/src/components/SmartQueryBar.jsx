import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { localQuery } from '../api/client';
import { queryClientData } from '../utils/clientQuery';
import './SmartQueryBar.css';

const Plot = createPlotlyComponent(Plotly);

function SmartQueryBar({ sessionId, dataPreview }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  // Generate dynamic contextual suggestions based on loaded columns
  const suggestions = useMemo(() => {
    const cols = dataPreview?.columns || [];
    const numCols = [];
    const catCols = [];

    const rows = dataPreview?.rows || [];
    cols.forEach(c => {
      const isNum = rows.slice(0, 10).some(r => r[c] !== null && !isNaN(Number(r[c])));
      if (isNum) numCols.push(c);
      else catCols.push(c);
    });

    const s = [];
    if (numCols.length > 0) s.push(`Highest ${numCols[0]}`);
    if (numCols.length > 0 && catCols.length > 0) {
      s.push(`Average ${numCols[0]} by ${catCols[0]}`);
    }
    s.push('What columns have missing data?');
    if (numCols.length > 1) s.push(`Distribution of ${numCols[1] || numCols[0]}`);
    s.push('Dataset summary');

    return s.slice(0, 4);
  }, [dataPreview]);

  const handleSearch = async (questionText) => {
    const q = (questionText || query).trim();
    if (!q || loading) return;

    setLoading(true);
    setResult(null);

    // Try backend local query engine first
    try {
      if (sessionId) {
        const res = await localQuery(sessionId, q);
        if (res && res.answer) {
          setResult({
            question: q,
            answer: res.answer,
            chart: res.chart,
            source: 'Local Pandas Engine',
          });
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      // Backend not running / offline — fallback to client-side query engine
      console.log('Falling back to browser smart query engine:', err.message);
    }

    // Client-side fallback
    try {
      const clientRes = queryClientData(dataPreview, q);
      setResult({
        question: q,
        answer: clientRes.answer,
        chart: clientRes.chart,
        source: 'Offline Browser Engine',
      });
    } catch (err) {
      setResult({
        question: q,
        answer: `Sorry, could not process: ${err.message}`,
        chart: null,
        source: 'Error',
      });
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    handleSearch(s);
  };

  // Convert simple markdown (**bold**, - bullets) into formatted elements
  const renderFormattedAnswer = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Parse **bold** tags
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="query-strong">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (line.startsWith('- ')) {
        return (
          <li key={idx} className="query-list-item">
            {formattedParts}
          </li>
        );
      }
      return (
        <p key={idx} className="query-paragraph">
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="smart-query-container">
      {/* Search Input Bar */}
      <div className="smart-query-bar">
        <div className="smart-query-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          className="smart-query-input"
          placeholder="Ask anything in plain English... (e.g. 'Highest salary', 'Average by department', 'Missing data')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        {query && (
          <button
            className="smart-query-clear"
            onClick={() => { setQuery(''); setResult(null); inputRef.current?.focus(); }}
            title="Clear"
          >
            ✕
          </button>
        )}

        <button
          className="smart-query-btn"
          onClick={() => handleSearch()}
          disabled={!query.trim() || loading}
        >
          {loading ? (
            <span className="smart-query-spinner" />
          ) : (
            <>
              <span>Ask Data</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Suggestion Chips */}
      <div className="smart-query-chips">
        <span className="chips-label">Quick Queries:</span>
        {suggestions.map((s, i) => (
          <button
            key={i}
            className="query-chip"
            onClick={() => handleSuggestionClick(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Result Display Card */}
      <AnimatePresence>
        {result && (
          <motion.div
            className="query-result-card"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="query-result-header">
              <div className="query-result-title">
                <span className="result-badge">Q&A</span>
                <span className="result-question">"{result.question}"</span>
              </div>
              <div className="query-result-actions">
                <span className="result-source-badge">{result.source}</span>
                <button
                  className="result-dismiss-btn"
                  onClick={() => setResult(null)}
                  title="Dismiss result"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="query-result-body">
              <div className="query-answer-text">
                {renderFormattedAnswer(result.answer)}
              </div>

              {result.chart && result.chart.data && (
                <div className="query-result-chart">
                  <Plot
                    data={result.chart.data}
                    layout={{
                      ...result.chart.layout,
                      paper_bgcolor: 'transparent',
                      plot_bgcolor: 'transparent',
                      font: { family: 'Inter, sans-serif', color: '#9C9892', size: 11 },
                      margin: { t: 30, r: 20, b: 60, l: 60 },
                      autosize: true,
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: '100%', height: '280px' }}
                    useResizeHandler
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SmartQueryBar;
