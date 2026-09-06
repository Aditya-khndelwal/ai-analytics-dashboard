import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions } from '../api/client';
import './CommandPalette.css';

const CommandPalette = ({ isOpen, onClose, onAction, appState }) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      inputRef.current?.focus();
      // Fetch history
      getSessions().then(data => setHistory(data.sessions || [])).catch(() => {});
    }
  }, [isOpen]);

  const commands = [
    { id: 'new', label: 'New Analysis', desc: 'Upload a new dataset', icon: '➕', action: () => onAction('new') },
    { id: 'overview', label: 'Go to Overview', desc: 'Dashboard overview tab', icon: '📋', action: () => onAction('tab', 'overview'), show: appState === 'dashboard' },
    { id: 'charts', label: 'Go to Charts', desc: 'View all charts', icon: '📊', action: () => onAction('tab', 'charts'), show: appState === 'dashboard' },
    { id: 'custom', label: 'Custom Chart Builder', desc: 'Build a custom chart', icon: '🎨', action: () => onAction('tab', 'custom'), show: appState === 'dashboard' },
    { id: 'data', label: 'Go to Data', desc: 'View data table', icon: '📄', action: () => onAction('tab', 'data'), show: appState === 'dashboard' },
    { id: 'export', label: 'Go to Export', desc: 'Download reports', icon: '📥', action: () => onAction('tab', 'export'), show: appState === 'dashboard' },
    { id: 'chat', label: 'Ask AI', desc: 'Chat with your data', icon: '🤖', action: () => onAction('chat'), show: appState === 'dashboard' },
    { id: 'share', label: 'Share Dashboard', desc: 'Generate a shareable link', icon: '🔗', action: () => onAction('share'), show: appState === 'dashboard' },
    { id: 'theme', label: 'Toggle Theme', desc: 'Switch dark/light mode', icon: '🌗', action: () => onAction('theme') },
    { id: 'home', label: 'Go to Landing Page', desc: 'Return to home', icon: '🏠', action: () => onAction('home') },
  ];

  // Filter commands
  const filteredCommands = commands.filter(c => {
    if (c.show === false) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
  });

  // Add history items
  const historyItems = history
    .filter(s => s.status === 'complete')
    .filter(s => !query.trim() || s.original_filename?.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)
    .map(s => ({
      id: `history-${s.id}`,
      label: s.original_filename || 'Untitled',
      desc: `${s.row_count} rows · ${s.col_count} cols · ${new Date(s.uploaded_at).toLocaleDateString()}`,
      icon: '📂',
      action: () => onAction('load', s.id, s.original_filename),
    }));

  const allItems = [...filteredCommands, ...historyItems];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIdx]) {
      allItems[selectedIdx].action();
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cmd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="cmd-palette"
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmd-input-wrap">
              <svg className="cmd-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                className="cmd-input"
                placeholder="Type a command or search history..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
                onKeyDown={handleKeyDown}
              />
              <kbd className="cmd-kbd">ESC</kbd>
            </div>

            <div className="cmd-list">
              {filteredCommands.length > 0 && (
                <div className="cmd-group">
                  <div className="cmd-group-label">Commands</div>
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      className={`cmd-item ${selectedIdx === i ? 'selected' : ''}`}
                      onClick={() => { cmd.action(); onClose(); }}
                      onMouseEnter={() => setSelectedIdx(i)}
                    >
                      <span className="cmd-item-icon">{cmd.icon}</span>
                      <div className="cmd-item-text">
                        <span className="cmd-item-label">{cmd.label}</span>
                        <span className="cmd-item-desc">{cmd.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {historyItems.length > 0 && (
                <div className="cmd-group">
                  <div className="cmd-group-label">Recent Analyses</div>
                  {historyItems.map((item, i) => {
                    const idx = filteredCommands.length + i;
                    return (
                      <button
                        key={item.id}
                        className={`cmd-item ${selectedIdx === idx ? 'selected' : ''}`}
                        onClick={() => { item.action(); onClose(); }}
                        onMouseEnter={() => setSelectedIdx(idx)}
                      >
                        <span className="cmd-item-icon">{item.icon}</span>
                        <div className="cmd-item-text">
                          <span className="cmd-item-label">{item.label}</span>
                          <span className="cmd-item-desc">{item.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {allItems.length === 0 && (
                <div className="cmd-empty">No results found</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
