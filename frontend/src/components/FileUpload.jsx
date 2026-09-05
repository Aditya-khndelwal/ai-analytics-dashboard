import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './FileUpload.css';
import { uploadFile, uploadFromUrl, triggerAnalysis } from '../api/client';

const FileUpload = ({ onUploadComplete }) => {
  const [mode, setMode] = useState('file'); // 'file' or 'url'
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setError(null);
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(fileExtension)) {
      setError('Invalid file type. Please upload a .csv, .xlsx, or .xls file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAnalyzeFile = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const uploadResponse = await uploadFile(selectedFile);
      const sessionId = uploadResponse.session_id;
      await triggerAnalysis(sessionId);
      onUploadComplete(sessionId, selectedFile.name);
    } catch (err) {
      setError(err.message || 'An error occurred during upload.');
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!url.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const uploadResponse = await uploadFromUrl(url.trim());
      const sessionId = uploadResponse.session_id;
      await triggerAnalysis(sessionId);
      onUploadComplete(sessionId, uploadResponse.filename);
    } catch (err) {
      setError(err.message || 'Failed to load dataset from URL.');
      setIsAnalyzing(false);
    }
  };

  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') handleAnalyzeUrl();
  };

  return (
    <div className="file-upload-container">
      {/* Mode tabs */}
      <div className="upload-mode-tabs">
        <button
          className={`upload-mode-tab ${mode === 'file' ? 'active' : ''}`}
          onClick={() => { setMode('file'); setError(null); }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
          Upload File
        </button>
        <button
          className={`upload-mode-tab ${mode === 'url' ? 'active' : ''}`}
          onClick={() => { setMode('url'); setError(null); }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
          Paste URL
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'file' ? (
          <motion.div
            key="file-mode"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              whileHover={{ borderColor: 'var(--accent)', boxShadow: '0 0 15px rgba(201,167,106,0.05)' }}
              animate={dragOver ? { borderColor: 'var(--accent)', backgroundColor: 'rgba(201,167,106,0.03)' } : {}}
              transition={{ duration: 0.2 }}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <AnimatePresence mode="wait">
                {!selectedFile ? (
                  <motion.div key="upload-prompt" className="upload-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <svg className="upload-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 16L12 11M12 11L17 16M12 11V21M20.39 15.39C21.3765 14.808 22.0837 13.8824 22.3996 12.7937C22.7154 11.705 22.6186 10.5305 22.129 9.49755C21.6393 8.46457 20.7915 7.64506 19.7485 7.20013C18.7056 6.75519 17.5413 6.71616 16.48 7.09001C15.9329 5.37893 14.7865 3.93175 13.2505 2.97333C11.7145 2.01492 9.8885 1.60337 8.09999 1.80001C6.31149 1.99665 4.67812 2.78922 3.49007 4.03212C2.30202 5.27501 1.63854 6.88371 1.6 8.59999C1.14496 8.78453 0.742398 9.07196 0.428514 9.43577C0.114631 9.79958 -0.0494499 10.2285 -0.0469999 10.6814C-0.0445499 11.1344 0.1245 11.5615 0.441999 11.9213C0.759499 12.281 1.1645 12.5645 1.62 12.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <h2 className="upload-title">Drop your data file here</h2>
                    <p className="upload-subtitle">Supports CSV and Excel files up to 10MB</p>
                    <button className="btn-primary browse-btn" onClick={() => fileInputRef.current?.click()}>Browse Files</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx,.xls" style={{ display: 'none' }} />
                  </motion.div>
                ) : (
                  <motion.div key="file-info" className="file-selected-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="file-info-box">
                      <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                      <div className="file-details">
                        <span className="file-name">{selectedFile.name}</span>
                        <span className="card-badge size-badge">{formatFileSize(selectedFile.size)}</span>
                      </div>
                      <button className="btn-ghost remove-btn" onClick={() => setSelectedFile(null)} disabled={isAnalyzing}>
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    <motion.button whileTap={!isAnalyzing ? { scale: 0.97 } : {}} className="btn-primary analyze-btn" onClick={handleAnalyzeFile} disabled={isAnalyzing}>
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Data'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {isAnalyzing && (
                <motion.div
                  style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', backgroundColor: 'var(--accent)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%', opacity: [1, 0.5, 1] }}
                  transition={{ width: { duration: 2, ease: 'linear', repeat: Infinity }, opacity: { duration: 1, repeat: Infinity } }}
                />
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="url-mode"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="url-upload-zone">
              <svg className="url-upload-icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              <h3 className="url-upload-title">Paste a dataset URL</h3>
              <p className="url-upload-subtitle">Direct link to a CSV or Excel file (GitHub raw, Kaggle, etc.)</p>
              <div className="url-input-row">
                <input
                  type="url"
                  className="url-input"
                  placeholder="https://example.com/data.csv"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleUrlKeyDown}
                  disabled={isAnalyzing}
                />
                <motion.button
                  whileTap={!isAnalyzing ? { scale: 0.97 } : {}}
                  className="btn-primary url-submit-btn"
                  onClick={handleAnalyzeUrl}
                  disabled={!url.trim() || isAnalyzing}
                >
                  {isAnalyzing ? 'Loading...' : 'Analyze'}
                </motion.button>
              </div>
              <p className="url-upload-hint">Tip: On GitHub, use the "Raw" button to get a direct link to a CSV file</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <div className="upload-error">{error}</div>}
    </div>
  );
};

export default FileUpload;
