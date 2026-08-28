import React from 'react';
import { motion } from 'framer-motion';
import './DataPreview.css';

const DataPreview = ({ data }) => {
  if (!data || !data.rows || data.rows.length === 0 || !data.columns) {
    return (
      <div className="card data-preview-empty">
        <p>No data preview available</p>
      </div>
    );
  }

  const { columns, rows, column_types } = data;
  const totalRows = data.total_rows || rows.length;

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
        <h3 className="card-title">Data Preview</h3>
        <span className="preview-subtitle">Showing {rows.length} of {totalRows} rows</span>
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
            {rows.map((row, rowIdx) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default DataPreview;
