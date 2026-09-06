import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './CommandPalette.css'; // Tour styles are in the same CSS

const TOUR_STEPS = [
  {
    icon: '👋',
    title: 'Welcome to Analytix AI',
    desc: 'Upload any CSV or Excel file and get AI-powered analysis with charts, insights, and downloadable reports — all in seconds.',
  },
  {
    icon: '📊',
    title: 'Smart Charts & Custom Builder',
    desc: 'Auto-generated charts analyze your data. Switch chart types, expand fullscreen, download as PNG, or build your own custom charts.',
  },
  {
    icon: '🤖',
    title: 'Chat with Your Data',
    desc: 'Click the chat bubble to ask AI questions like "What are the top trends?" — it can even generate charts for you.',
  },
  {
    icon: '⌨️',
    title: 'Power User Shortcuts',
    desc: 'Press Ctrl+K to open the Command Palette. Use 1-4 to switch tabs, N for new analysis. Toggle dark/light theme from the sidebar.',
  },
  {
    icon: '🔗',
    title: 'Share & Export',
    desc: 'Share your dashboard with a link, download PDF/Word reports, or export filtered data as CSV. Ready to explore?',
  },
];

const TOUR_STORAGE_KEY = 'analytix_tour_completed';

function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!done) {
      // Small delay so landing page loads first
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setShow(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="tour-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="tour-card"
            key={step}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="tour-icon">{TOUR_STEPS[step].icon}</div>
            <h2 className="tour-title">{TOUR_STEPS[step].title}</h2>
            <p className="tour-desc">{TOUR_STEPS[step].desc}</p>

            <div className="tour-actions">
              <button className="tour-btn tour-btn-skip" onClick={handleClose}>Skip</button>
              <button className="tour-btn tour-btn-primary" onClick={handleNext}>
                {step < TOUR_STEPS.length - 1 ? 'Next' : "Let's Go!"}
              </button>
            </div>

            <div className="tour-dots">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`tour-dot ${i === step ? 'active' : ''}`} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OnboardingTour;
