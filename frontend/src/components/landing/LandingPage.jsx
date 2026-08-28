import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import ParticleCanvas from './ParticleCanvas';
import TextFlippingBoard from '../ui/TextFlippingBoard';
import DecryptedText from '../ui/DecryptedText';
import FileUpload from '../FileUpload';
import './LandingPage.css';

/* ── Animated CountUp ── */
function CountUp({ target, duration = 1800 }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' });

  useEffect(() => {
    if (!isInView) return;
    const num = parseInt(String(target).replace(/[^0-9]/g, ''), 10);
    if (isNaN(num) || num === 0) { setDisplay(String(target)); return; }
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * num).toLocaleString());
      if (progress < 1) requestAnimationFrame(animate);
      else setDisplay(num.toLocaleString());
    };
    requestAnimationFrame(animate);
  }, [isInView, target, duration]);

  return <span ref={ref}>{display}</span>;
}

/* ── Reveal on scroll ── */
function ScrollReveal({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Hero entrance reveal ── */
function RevealText({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Floating glow orb ── */
function GlowOrb() {
  return (
    <motion.div
      className="glow-orb"
      animate={{
        x: [0, 30, -20, 10, 0],
        y: [0, -20, 15, -10, 0],
        scale: [1, 1.1, 0.95, 1.05, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
    />
  );
}

/* ── 3D Tilt Card ── */
function TiltCard({ children, className = '', delay = 0 }) {
  const cardRef = useRef(null);
  const [style, setStyle] = useState({});

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateX(${y * -6}deg) rotateY(${x * 6}deg)`,
      transition: 'transform 0.1s ease-out',
    });
  };

  const handleMouseLeave = () => {
    setStyle({ transform: 'perspective(800px) rotateX(0deg) rotateY(0deg)', transition: 'transform 0.4s ease-out' });
  };

  return (
    <motion.div
      ref={cardRef}
      className={className}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Bento Features Data ── */
const bentoItems = [
  { icon: '⚡', title: 'Lightning Fast', desc: 'Full analysis in under 30 seconds — not hours of manual work.', size: 'wide' },
  { icon: '📊', title: 'Smart Charts', desc: 'Auto-selects the best visualization for each column and relationship.', size: 'normal' },
  { icon: '🤖', title: 'AI Narratives', desc: 'Executive summaries, key findings, and recommendations in plain English.', size: 'normal' },
  { icon: '🔒', title: 'Private & Secure', desc: 'Your data stays on your machine. Nothing is stored or shared.', size: 'normal' },
  { icon: '📄', title: 'Export Reports', desc: 'Download professional PDF and Word reports with one click.', size: 'normal' },
  { icon: '🔍', title: 'Deep Analysis', desc: 'Correlations, distributions, outliers, missing data — all detected automatically.', size: 'wide' },
];

/* ── Pipeline Steps Data ── */
const pipelineSteps = [
  { label: 'Upload', desc: 'Drop your CSV or Excel file into the upload zone', icon: '📁' },
  { label: 'Parse', desc: 'Schema detection, type inference, and data validation', icon: '🔧' },
  { label: 'Analyze', desc: 'Statistical analysis, correlation detection, outlier identification', icon: '📈' },
  { label: 'Narrate', desc: 'AI generates executive summaries and actionable insights', icon: '✍️' },
  { label: 'Dashboard', desc: 'Interactive charts, data tables, and export options ready', icon: '🎯' },
];

/* ══════ Landing Page ══════ */
function LandingPage({ onUploadComplete }) {
  const [showFlipboard, setShowFlipboard] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.12], [1, 0.96]);

  useEffect(() => {
    // Show flipboard subtitle after decrypt finishes
    const timer = setTimeout(() => setShowFlipboard(true), 2800);
    return () => clearTimeout(timer);
  }, []);

  const scrollToUpload = () => {
    document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      {/* ═══ HERO ═══ */}
      <motion.section
        ref={heroRef}
        className="hero-section"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <ParticleCanvas />
        <GlowOrb />

        <div className="hero-content">
          <RevealText delay={0.1} className="hero-label">
            AI-POWERED ANALYTICS
          </RevealText>

          {/* Decrypt headline */}
          <RevealText delay={0.2} className="hero-headline-wrap">
            <h1 className="hero-headline">
              <DecryptedText
                text="YOUR DATA, DECODED."
                speed={55}
                scrambleSpeed={25}
                delay={600}
              />
            </h1>
          </RevealText>

          {/* Flipboard subtitle appears after decrypt */}
          <div className="hero-flipboard-area">
            {showFlipboard && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <TextFlippingBoard text="INSTANT AI INSIGHTS" />
              </motion.div>
            )}
          </div>

          <RevealText delay={0.8} className="hero-subtitle-wrap">
            <p className="hero-subtitle">
              Upload any dataset. Get interactive charts, AI-generated narratives,
              and exportable reports — in seconds.
            </p>
          </RevealText>

          {/* Shimmer CTA */}
          <RevealText delay={1.0}>
            <motion.button
              className="shimmer-btn"
              onClick={scrollToUpload}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="shimmer-btn-text">Get Started</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span className="shimmer-sweep" />
            </motion.button>
          </RevealText>

          <motion.div
            className="scroll-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4, y: [0, 10, 0] }}
            transition={{ opacity: { delay: 1.5 }, y: { repeat: Infinity, duration: 2, ease: 'easeInOut' } }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══ MARQUEE BAR ═══ */}
      <div className="marquee-bar">
        <div className="marquee-track">
          {[...Array(2)].map((_, i) => (
            <span key={i} className="marquee-content">
              UPLOAD &nbsp;·&nbsp; ANALYZE &nbsp;·&nbsp; VISUALIZE &nbsp;·&nbsp; EXPORT &nbsp;·&nbsp; INSIGHTS &nbsp;·&nbsp; PATTERNS &nbsp;·&nbsp; CORRELATIONS &nbsp;·&nbsp; AI-POWERED &nbsp;·&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ═══ BENTO FEATURES ═══ */}
      <section className="bento-section">
        <ScrollReveal>
          <h2 className="section-heading">Built for Real Data</h2>
          <p className="section-subheading">Everything you need, nothing you don't.</p>
        </ScrollReveal>

        <div className="bento-grid">
          {bentoItems.map((item, i) => (
            <TiltCard key={i} className={`bento-card ${item.size === 'wide' ? 'bento-wide' : ''}`} delay={i * 0.08}>
              <span className="bento-icon">{item.icon}</span>
              <h4 className="bento-title">{item.title}</h4>
              <p className="bento-desc">{item.desc}</p>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ═══ PIPELINE TIMELINE ═══ */}
      <section className="pipeline-section">
        <ScrollReveal>
          <h2 className="section-heading">The Pipeline</h2>
          <p className="section-subheading">From raw data to actionable insights in 5 stages.</p>
        </ScrollReveal>

        <div className="timeline">
          <div className="timeline-line" />
          {pipelineSteps.map((step, i) => (
            <motion.div
              key={i}
              className={`timeline-item ${i % 2 === 0 ? 'left' : 'right'}`}
              initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '0px 0px -80px 0px' }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="timeline-node">
                <span className="timeline-node-icon">{step.icon}</span>
              </div>
              <div className="timeline-card">
                <h4 className="timeline-label">{step.label}</h4>
                <p className="timeline-desc">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="stats-bar">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number"><CountUp target={10000} />+</div>
            <div className="stat-label">Rows Per Upload</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><CountUp target={50} />+</div>
            <div className="stat-label">Chart Types Supported</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number">&lt; <CountUp target={30} />s</div>
            <div className="stat-label">Average Processing Time</div>
          </div>
        </div>
      </section>

      {/* ═══ UPLOAD CTA ═══ */}
      <section className="upload-cta-section" id="upload-section">
        <motion.div
          className="upload-cta-content"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="section-heading">Ready to decode your data?</h2>
          <p className="upload-cta-subtitle">Drop your CSV or Excel file below to get started</p>
          <div className="upload-cta-box">
            <FileUpload onUploadComplete={onUploadComplete} />
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="landing-footer">
        <div className="footer-content">
          <span className="footer-brand">ANALYTIX AI</span>
          <span className="footer-dot">·</span>
          <span className="footer-text">AI-Powered Data Analytics</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
