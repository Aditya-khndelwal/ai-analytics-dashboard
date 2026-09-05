import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import './DataPreview.css';

const DataPreview = ({ data }) => {
  const [search, setSearch] = useState('');

  if (!data || !data.rows || data.rows.length === 0 || !data.columns) {
    return (
      <div className="card data-preview-empty">
        <p>No data preview available</p>
      </div>
    );
  }

  const { columns, rows, column_types } = data;
  const totalRows = data.total_rows || rows.length;

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(row =>
      columns.some(col => {
        const val = row[col];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
      })
    );
  }, [rows, columns, search]);

  const getTypeBadgeClass = (type) => {
    const typeStr = (type || '').toLowerCase();
    if (typeStr.includes('int') || typeStr.includes('float') || typeStr.includes('num')) return 'type-numeric';
    if (typeStr.includes('date') || typeStr.includes('time')) return 'type-datetime';
    return 'type-categorical';
  };

  return (
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
            {search ? `${filteredRows.length} matches` : `Showing ${rows.length} of ${totalRows} rows`}
          </span>
        </div>
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
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>
                  <div className="th-content">
                    <span className="col-name">{col}</span>
                    {column_types && column_types[col] && (
                      <motion.span 
                        className={`type-badge ${getTypeBadgeClass(column_types[col])}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.2 }}
                      >
                        {column_types[col]}
                      </motion.span>
                    )}
                  </div>
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
  );
};

export default DataPreview;
