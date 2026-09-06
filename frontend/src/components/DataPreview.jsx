import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DataPreview.css';

function ColumnStatsDrawer({ column, rows, columnType, onClose }) {
  const values = rows.map(r => r[column]).filter(v => v !== null && v !== undefined && v !== '');
  const total = rows.length;
  const nonEmpty = values.length;
  const missing = total - nonEmpty;
  const unique = new Set(values.map(String)).size;
  const completeness = total > 0 ? Math.round((nonEmpty / total) * 100) : 0;

  const isNumeric = values.length > 0 && values.every(v => !isNaN(Number(v)));
  let numStats = null;

  if (isNumeric && values.length > 0) {
    const nums = values.map(Number).sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const median = nums.length % 2 === 0
      ? (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
      : nums[Math.floor(nums.length / 2)];
    const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / nums.length;
    const stdDev = Math.sqrt(variance);
    const q1 = nums[Math.floor(nums.length * 0.25)];
    const q3 = nums[Math.floor(nums.length * 0.75)];

    numStats = {
      min: nums[0],
      max: nums[nums.length - 1],
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      q1: q1?.toFixed(2),
      q3: q3?.toFixed(2),
    };
  }

  // Top values for categorical
  const valueCounts = {};
  values.forEach(v => { const s = String(v); valueCounts[s] = (valueCounts[s] || 0) + 1; });
  const topValues = Object.entries(valueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <motion.div
      className="col-stats-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="col-stats-drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="col-stats-header">
          <div>
            <h3 className="col-stats-title">{column}</h3>
            <span className="col-stats-type">{columnType || 'unknown'}</span>
          </div>
          <button className="col-stats-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="col-stats-body">
          {/* Completeness bar */}
          <div className="stat-row">
            <span className="stat-row-label">Completeness</span>
            <div className="completeness-bar-wrap">
              <div className="completeness-bar">
                <motion.div
                  className="completeness-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${completeness}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ background: completeness > 80 ? 'var(--success-text)' : completeness > 50 ? 'var(--accent)' : 'var(--error-text)' }}
                />
              </div>
              <span className="completeness-pct">{completeness}%</span>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-cell">
              <span className="stat-cell-val">{total}</span>
              <span className="stat-cell-label">Total</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell-val">{nonEmpty}</span>
              <span className="stat-cell-label">Non-empty</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell-val">{missing}</span>
              <span className="stat-cell-label">Missing</span>
            </div>
            <div className="stat-cell">
              <span className="stat-cell-val">{unique}</span>
              <span className="stat-cell-label">Unique</span>
            </div>
          </div>

          {numStats && (
            <>
              <h4 className="col-stats-section-title">Numeric Statistics</h4>
              <div className="stat-grid">
                <div className="stat-cell"><span className="stat-cell-val">{numStats.min}</span><span className="stat-cell-label">Min</span></div>
                <div className="stat-cell"><span className="stat-cell-val">{numStats.max}</span><span className="stat-cell-label">Max</span></div>
                <div className="stat-cell"><span className="stat-cell-val">{numStats.mean}</span><span className="stat-cell-label">Mean</span></div>
                <div className="stat-cell"><span className="stat-cell-val">{numStats.median}</span><span className="stat-cell-label">Median</span></div>
                <div className="stat-cell"><span className="stat-cell-val">{numStats.stdDev}</span><span className="stat-cell-label">Std Dev</span></div>
                <div className="stat-cell"><span className="stat-cell-val">{numStats.q1}</span><span className="stat-cell-label">Q1</span></div>
                <div className="stat-cell"><span className="stat-cell-val">{numStats.q3}</span><span className="stat-cell-label">Q3</span></div>
              </div>
            </>
          )}

          <h4 className="col-stats-section-title">Top Values</h4>
          <div className="top-values-list">
            {topValues.map(([val, count], i) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={i} className="top-value-row">
                  <span className="top-value-name" title={val}>{val}</span>
                  <div className="top-value-bar-wrap">
                    <motion.div
                      className="top-value-bar"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                    />
                  </div>
                  <span className="top-value-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const DataPreview = ({ data }) => {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [statsColumn, setStatsColumn] = useState(null);

  if (!data || !data.rows || data.rows.length === 0 || !data.columns) {
    return (
      <div className="card data-preview-empty">
        <p>No data preview available</p>
      </div>
    );
  }

  const { columns, rows, column_types } = data;
  const totalRows = data.total_rows || rows.length;

  // Get unique values for each column (for filter dropdowns)
  const columnUniqueValues = useMemo(() => {
    const map = {};
    columns.forEach(col => {
      const vals = [...new Set(rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '').map(String))];
      map[col] = vals.sort().slice(0, 50); // cap at 50 for performance
    });
    return map;
  }, [columns, rows]);

  const filteredRows = useMemo(() => {
    let result = rows;

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          const val = row[col];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([col, filterVal]) => {
      if (filterVal) {
        result = result.filter(row => String(row[col] ?? '') === filterVal);
      }
    });

    return result;
  }, [rows, columns, search, filters]);

  const handleFilterChange = (col, val) => {
    setFilters(prev => ({ ...prev, [col]: val }));
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilters = () => setFilters({});

  const exportCsv = () => {
    const header = columns.join(',');
    const csvRows = filteredRows.map(row =>
      columns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_export_${filteredRows.length}_rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeBadgeClass = (type) => {
    const typeStr = (type || '').toLowerCase();
    if (typeStr.includes('int') || typeStr.includes('float') || typeStr.includes('num')) return 'type-numeric';
    if (typeStr.includes('date') || typeStr.includes('time')) return 'type-datetime';
    return 'type-categorical';
  };

  return (
    <>
      <motion.div
        className="card data-preview-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="card-header data-preview-header">
          <div className="data-preview-header-left">
            <h3 className="card-title">Data Preview</h3>
            <span className="preview-subtitle">
              {search || activeFilterCount > 0
                ? `${filteredRows.length} matches`
                : `Showing ${rows.length} of ${totalRows} rows`}
            </span>
            {activeFilterCount > 0 && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <div className="data-header-actions">
            <button className="csv-export-btn" onClick={exportCsv} title="Export as CSV">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              CSV
            </button>
            <div className="data-search-box">
            <svg className="data-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="data-search-input"
              placeholder="Search data..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="data-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx}>
                    <div className="th-content">
                      <button
                        className="col-name-btn"
                        onClick={() => setStatsColumn(col)}
                        title="Click for column statistics"
                      >
                        {col}
                      </button>
                      {column_types && column_types[col] && (
                        <span className={`type-badge ${getTypeBadgeClass(column_types[col])}`}>
                          {column_types[col]}
                        </span>
                      )}
                    </div>
                    {/* Column filter dropdown */}
                    <select
                      className="col-filter-select"
                      value={filters[col] || ''}
                      onChange={(e) => handleFilterChange(col, e.target.value)}
                    >
                      <option value="">All</option>
                      {(columnUniqueValues[col] || []).map((v, i) => (
                        <option key={i} value={v}>{v.length > 20 ? v.slice(0, 20) + '…' : v}</option>
                      ))}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                    No matching rows found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rowIdx) => (
                  <motion.tr
                    key={rowIdx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(rowIdx, 10) * 0.03, duration: 0.3 }}
                  >
                    {columns.map((col, colIdx) => {
                      const cellValue = row[col];
                      const isEmpty = cellValue === null || cellValue === undefined || cellValue === '';
                      return (
                        <td key={colIdx}>
                          {isEmpty ? (
                            <span className="empty-cell">—</span>
                          ) : (
                            <span className="cell-content" title={String(cellValue)}>
                              {String(cellValue)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Column Stats Drawer */}
      <AnimatePresence>
        {statsColumn && (
          <ColumnStatsDrawer
            column={statsColumn}
            rows={rows}
            columnType={column_types?.[statsColumn]}
            onClose={() => setStatsColumn(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default DataPreview;
