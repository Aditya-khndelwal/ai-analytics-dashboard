import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import './NarrativePanel.css';

function TypewriterText({ text, speed = 20 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) return;
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return <>{displayed}<span className="typewriter-cursor">|</span></>;
}

const CollapsibleSection = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={() => setIsOpen(!isOpen)}>
        <h4 className="section-title">{title}</h4>
        <motion.svg 
          className="chevron"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          viewBox="0 0 24 24" 
          width="20" height="20" 
          stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div 
            className="collapsible-content open"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="collapsible-inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FadeInSection = ({ children, className }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-20% 0px' });
  return (
    <motion.section 
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  );
};

const NarrativePanel = ({ narrative }) => {
  if (!narrative) return null;

  return (
    <div className="narrative-panel">
      {narrative.executive_summary && (
        <FadeInSection className="card exec-summary">
          <h3 className="section-title">Executive Summary</h3>
          <p className="body-text">
            <TypewriterText text={narrative.executive_summary} speed={20} />
          </p>
        </FadeInSection>
      )}

      {narrative.key_findings && narrative.key_findings.filter(f => f && f.trim()).length > 0 && (
        <FadeInSection className="narrative-section">
          <h3 className="section-title">Key Findings</h3>
          <div className="findings-list">
            {narrative.key_findings.filter(f => f && f.trim()).map((finding, index) => (
              <motion.div 
                key={index} 
                className="finding-row"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.12, duration: 0.4, ease: 'easeOut' }}
              >
                <motion.div 
                  className="finding-number"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.12 + 0.1, duration: 0.3, ease: 'easeOut' }}
                >
                  {index + 1}
                </motion.div>
                <p className="body-text">{finding}</p>
              </motion.div>
            ))}
          </div>
        </FadeInSection>
      )}

      {(() => {
        const validInsights = (narrative.column_insights || []).filter(
          (insight) => insight && insight.column_name && insight.description && insight.description.trim()
        );
        if (validInsights.length === 0) return null;
        return (
          <FadeInSection className="narrative-section">
            <h3 className="section-title">Column Insights</h3>
            <div className="insights-container">
              {validInsights.map((insight, index) => (
                <CollapsibleSection key={index} title={insight.column_name}>
                  <p className="body-text">{insight.description}</p>
                </CollapsibleSection>
              ))}
            </div>
          </FadeInSection>
        );
      })()}

      {narrative.recommendations && narrative.recommendations.filter(r => r && r.trim()).length > 0 && (
        <FadeInSection className="narrative-section">
          <h3 className="section-title">Recommendations</h3>
          <ul className="recommendations-list">
            {narrative.recommendations.filter(r => r && r.trim()).map((rec, index) => (
              <li key={index} className="body-text">{rec}</li>
            ))}
          </ul>
        </FadeInSection>
      )}
    </div>
  );
};

export default NarrativePanel;
