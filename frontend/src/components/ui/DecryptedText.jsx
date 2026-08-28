import React, { useState, useEffect, useRef } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

/**
 * DecryptedText — characters scramble/decrypt before revealing the final text.
 * Props:
 *   text: string — the final text to reveal
 *   speed: number — ms between each character lock (default 60)
 *   scrambleSpeed: number — ms between scramble ticks (default 30)
 *   delay: number — ms before animation starts (default 300)
 *   className: string
 *   onComplete: () => void
 */
function DecryptedText({ text = '', speed = 60, scrambleSpeed = 30, delay = 300, className = '', onComplete }) {
  const [display, setDisplay] = useState('');
  const [started, setStarted] = useState(false);
  const lockedRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!text) return;
    // Initialize with random characters
    setDisplay(text.split('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join(''));

    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [text, delay]);

  useEffect(() => {
    if (!started || !text) return;
    lockedRef.current = 0;

    // Scramble interval — rapidly cycle unlocked characters
    intervalRef.current = setInterval(() => {
      const locked = lockedRef.current;
      setDisplay(
        text.split('').map((char, i) => {
          if (i < locked) return char; // already revealed
          if (char === ' ') return ' ';
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join('')
      );
    }, scrambleSpeed);

    // Lock interval — reveal one character at a time
    const lockTimer = setInterval(() => {
      lockedRef.current++;
      if (lockedRef.current >= text.length) {
        clearInterval(lockTimer);
        clearInterval(intervalRef.current);
        setDisplay(text);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(lockTimer);
    };
  }, [started, text, speed, scrambleSpeed, onComplete]);

  return <span className={className}>{display}</span>;
}

export default DecryptedText;
