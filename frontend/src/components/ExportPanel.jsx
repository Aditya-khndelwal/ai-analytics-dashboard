import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadReport } from '../api/client';
import './ExportPanel.css';

const ExportPanel = ({ sessionId, filename }) => {
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [successFormat, setSuccessFormat] = useState(null);

  const handleDownload = async (format) => {
    if (downloadingFormat) return;
    setDownloadingFormat(format);
    setSuccessFormat(null);
    
    try {
      await downloadReport(sessionId, format);
      setSuccessFormat(format);
      setTimeout(() => setSuccessFormat(null), 2000);
    } catch (error) {
      console.error(`Error downloading ${format}:`, error);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const renderButtonContent = (format) => {
    if (downloadingFormat === format) {
      return (
        <motion.div 
          className="spinner"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        />
      );
    }
    if (successFormat === format) {
      return (
        <motion.svg 
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </motion.svg>
      );
    }
    return 'Download';
  };

  return (
    <div className="export-panel">
      <motion.div 
        className="card export-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.4, ease: 'easeOut' }}
        whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }}
      >
        <div className="export-icon pdf-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <div className="export-content">
          <h3 className="export-title">PDF Report</h3>
          <p className="export-desc">Executive summary, charts, and key findings formatted for sharing.</p>
        </div>
        <motion.button 
          className="btn-primary export-btn" 
          onClick={() => handleDownload('pdf')}
          disabled={downloadingFormat !== null}
          whileTap={{ scale: 0.96 }}
        >
          {renderButtonContent('pdf')}
        </motion.button>
      </motion.div>

      <motion.div 
        className="card export-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }}
      >
        <div className="export-icon word-icon">
          <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M9 15l2 2 4-4"></path>
          </svg>
        </div>
        <div className="export-content">
          <h3 className="export-title">Word Report</h3>
          <p className="export-desc">Editable document with raw insights and unstyled charts.</p>
        </div>
        <motion.button 
          className="btn-secondary export-btn" 
          onClick={() => handleDownload('docx')}
          disabled={downloadingFormat !== null}
          whileTap={{ scale: 0.96 }}
        >
          {renderButtonContent('docx')}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ExportPanel;
