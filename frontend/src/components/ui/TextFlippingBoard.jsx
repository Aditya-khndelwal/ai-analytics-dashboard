import React, { useState, useEffect } from 'react';
import './TextFlippingBoard.css';

const ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!-";

function getRandomChar() {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

const FlapCharacter = ({ targetChar }) => {
  const [displayChar, setDisplayChar] = useState(' ');
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (targetChar === displayChar) return;

    setIsFlipping(true);
    let flips = 0;
    const maxFlips = 4 + Math.floor(Math.random() * 4);
    const intervalTime = 80 + Math.random() * 40;

    const interval = setInterval(() => {
      flips++;
      if (flips >= maxFlips) {
        clearInterval(interval);
        setDisplayChar(targetChar.toUpperCase());
        setTimeout(() => setIsFlipping(false), 100);
      } else {
        setDisplayChar(getRandomChar());
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [targetChar]);

  return (
    <div className={`flap-char ${isFlipping ? 'flipping' : ''}`}>
      <span className="flap-display">{displayChar}</span>
    </div>
  );
};

const TextFlippingBoard = ({ text = "", className = "" }) => {
  return (
    <div className={`text-flipping-board ${className}`}>
      {text.split('').map((char, i) => (
        <FlapCharacter key={i} targetChar={char} />
      ))}
    </div>
  );
};

export default TextFlippingBoard;
