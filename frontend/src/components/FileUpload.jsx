import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './FileUpload.css';
import { uploadFile, triggerAnalysis } from '../api/client';

const FileUpload = ({ onUploadComplete }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

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

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const uploadResponse = await uploadFile(selectedFile);
      const sessionId = uploadResponse.session_id;
      await triggerAnalysis(sessionId);
      onUploadComplete(sessionId, selectedFile.name);
    } catch (err) {
      setError(err.message || 'An error occurred during upload or analysis.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="file-upload-container">
      <motion.div 
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ borderColor: 'var(--accent, #6366f1)', boxShadow: '0 0 15px rgba(99, 102, 241, 0.1)' }}
        animate={dragOver ? { borderColor: 'var(--accent, #6366f1)', backgroundColor: 'rgba(99, 102, 241, 0.05)' } : {}}
        transition={{ duration: 0.2 }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <AnimatePresence mode="wait">
          {!selectedFile ? (
            <motion.div 
              key="upload-prompt"
              className="upload-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <svg className="upload-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 16L12 11M12 11L17 16M12 11V21M20.39 15.39C21.3765 14.808 22.0837 13.8824 22.3996 12.7937C22.7154 11.705 22.6186 10.5305 22.129 9.49755C21.6393 8.46457 20.7915 7.64506 19.7485 7.20013C18.7056 6.75519 17.5413 6.71616 16.48 7.09001C15.9329 5.37893 14.7865 3.93175 13.2505 2.97333C11.7145 2.01492 9.8885 1.60337 8.09999 1.80001C6.31149 1.99665 4.67812 2.78922 3.49007 4.03212C2.30202 5.27501 1.63854 6.88371 1.6 8.59999C1.14496 8.78453 0.742398 9.07196 0.428514 9.43577C0.114631 9.79958 -0.0494499 10.2285 -0.0469999 10.6814C-0.0445499 11.1344 0.1245 11.5615 0.441999 11.9213C0.759499 12.281 1.1645 12.5645 1.62 12.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="upload-title">Drop your data file here</h2>
              <p className="upload-subtitle">Supports CSV and Excel files up to 10MB</p>
              <button className="btn-primary browse-btn" onClick={() => fileInputRef.current?.click()}>
                Browse Files
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv, .xlsx, .xls" 
                style={{ display: 'none' }}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="file-info"
              className="file-selected-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
               <div className="file-info-box">
                  <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <div className="file-details">
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="card-badge size-badge">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <button className="btn-ghost remove-btn" onClick={() => setSelectedFile(null)} disabled={isAnalyzing}>
                     <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
               </div>
               <motion.button 
                  whileTap={!isAnalyzing ? { scale: 0.97 } : {}}
                  className="btn-primary analyze-btn" 
                  onClick={handleAnalyze} 
                  disabled={isAnalyzing}
               >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Data'}
               </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Loading progress bar */}
        {isAnalyzing && (
          <motion.div 
            style={{ 
              position: 'absolute', 
              bottom: 0, left: 0, 
              height: '3px', 
              backgroundColor: 'var(--accent, #6366f1)' 
            }}
            initial={{ width: '0%', opacity: 1 }}
            animate={{ width: '100%', opacity: [1, 0.5, 1] }}
            transition={{ 
              width: { duration: 2, ease: "linear", repeat: Infinity },
              opacity: { duration: 1, repeat: Infinity }
            }}
          />
        )}
      </motion.div>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
};

export default FileUpload;
