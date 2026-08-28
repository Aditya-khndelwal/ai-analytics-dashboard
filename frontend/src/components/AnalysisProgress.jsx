import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextFlippingBoard from './ui/TextFlippingBoard';
import './AnalysisProgress.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const AnalysisProgress = ({ sessionId, onComplete, onError }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const steps = ['Parsing', 'Analyzing', 'Generating Insights', 'Complete'];

  useEffect(() => {
    let intervalId;
    let mounted = true;
    let completed = false;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status/${sessionId}`);
        if (!res.ok) throw new Error('Failed to fetch status');
        const data = await res.json();
        
        if (!mounted || completed) return;

        switch (data.status) {
          case 'uploaded':
          case 'parsing':
            setCurrentStep(0);
            break;
          case 'analyzing':
            setCurrentStep(1);
            break;
          case 'narrating':
          case 'generating':
            setCurrentStep(2);
            break;
          case 'complete':
            completed = true;
            setCurrentStep(3);
            if (intervalId) clearInterval(intervalId);
            setTimeout(() => {
              if (mounted) onComplete();
            }, 1000);
            break;
          case 'error':
            if (intervalId) clearInterval(intervalId);
            setErrorMsg(data.error || 'Analysis failed.');
            if (onError) onError(data.error || 'Analysis failed.');
            break;
          default:
            break;
        }
      } catch (err) {
        if (!mounted) return;
        console.error(err);
      }
    };

    intervalId = setInterval(checkStatus, 2000);
    checkStatus(); // initial check

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const getStatusMessage = () => {
    if (errorMsg) return 'ERROR DURING ANALYSIS';
    switch (currentStep) {
      case 0: return 'PARSING UPLOADED DATA';
      case 1: return 'ANALYZING DATA STRUCTURES';
      case 2: return 'GENERATING AI INSIGHTS';
      case 3: return 'ANALYSIS COMPLETE';
      default: return 'INITIALIZING';
    }
  };

  const isAllComplete = currentStep === 3 && !errorMsg;

  return (
    <motion.div 
      className="progress-container"
      initial={{ opacity: 1 }}
      animate={{ opacity: isAllComplete ? 0.8 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="pipeline">
        {steps.map((step, index) => {
          const isComplete = index < currentStep || currentStep === 3;
          const isActive = index === currentStep && !errorMsg && currentStep !== 3;
          const isPending = index > currentStep;

          let stepClass = 'pipeline-step';
          if (isComplete) stepClass += ' complete';
          if (isActive) stepClass += ' active';
          if (isPending) stepClass += ' pending';
          if (errorMsg && isActive) stepClass += ' error';

          return (
            <motion.div 
              key={index} 
              className="step-wrapper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1, ease: 'easeOut' }}
            >
              <div className={stepClass}>
                <motion.div 
                  className="step-circle"
                  animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
                >
                  {isComplete ? (
                     <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>
                <div className="step-label">{step}</div>
              </div>
              {index < steps.length - 1 && (
                <div className="connector">
                  <motion.div 
                    className="connector-fill"
                    initial={{ width: '0%' }}
                    animate={{ width: index < currentStep ? '100%' : '0%' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ height: '100%', backgroundColor: 'var(--accent, #6366f1)' }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
        <TextFlippingBoard text={getStatusMessage()} />
      </div>

      <AnimatePresence>
        {isAllComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{ marginTop: '1rem', color: 'var(--accent, #6366f1)', fontWeight: 'bold' }}
          >
            ✓ Success
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnalysisProgress;
