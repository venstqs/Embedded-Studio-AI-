import React, { useEffect, useState } from 'react';

const MESSAGES = [
  'Initializing CAD Environment...',
  'Loading Component Libraries...',
  'Connecting Simulation Engine...',
  'Warming up AI Copilot...',
  'Ready!',
];

const LoadingScreen: React.FC = () => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx(prev => Math.min(prev + 1, MESSAGES.length - 1));
      setProgress(prev => Math.min(prev + 25, 100));
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-primary)] flex flex-col items-center justify-center">
      {/* Animated logo */}
      <div className="mb-10 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-28 h-28 border border-[var(--color-cyan)] rounded-full opacity-20" />
        </div>
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Spinning rings */}
          <div className="absolute w-full h-full border-t-2 border-[var(--color-cyan)] rounded-full animate-spin" />
          <div className="absolute w-16 h-16 border-b-2 border-[var(--color-red)] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          {/* Gear icon center */}
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.34.07-.68.07-1.08s-.03-.74-.07-1.08l2.32-1.82c.21-.16.27-.46.13-.7l-2.2-3.82c-.14-.24-.42-.32-.68-.24l-2.74 1.1c-.57-.44-1.18-.8-1.86-1.08l-.42-2.9c-.04-.26-.26-.46-.54-.46H9.25c-.28 0-.5.2-.54.46l-.42 2.9c-.68.28-1.3.64-1.86 1.08l-2.74-1.1c-.26-.08-.54 0-.68.24L.81 9.7c-.14.24-.08.54.13.7l2.32 1.82c-.04.34-.07.69-.07 1.08s.03.74.07 1.08L.94 16.2c-.21.16-.27.46-.13.7l2.2 3.82c.14.24.42.32.68.24l2.74-1.1c.57.44 1.18.8 1.86 1.08l.42 2.9c.04.26.26.46.54.46h4.4c.28 0 .5-.2.54-.46l.42-2.9c.68-.28 1.3-.64 1.86-1.08l2.74 1.1c.26.08.54 0 .68-.24l2.2-3.82c.14-.24.08-.54-.13-.7l-2.32-1.82z"/>
          </svg>
        </div>
      </div>

      {/* Brand name */}
      <h1 className="logo-text text-4xl tracking-[0.25em] uppercase mb-1">XAVIERLABS</h1>
      <p className="text-[var(--text-muted)] text-xs tracking-[0.4em] uppercase mb-10">Embedded Studio</p>

      {/* Progress bar */}
      <div className="w-64 h-1 bg-[var(--border-color)] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #06b6d4, #3b82f6)'
          }}
        />
      </div>

      <p className="text-[var(--text-muted)] font-mono text-xs tracking-wider">
        {MESSAGES[msgIdx]}
      </p>
    </div>
  );
};

export default LoadingScreen;
