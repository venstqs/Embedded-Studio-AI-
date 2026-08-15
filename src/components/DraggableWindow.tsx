import React, { useState, useRef, type PointerEvent } from 'react';

interface Props {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  initialX?: number;
  initialY?: number;
  width?: number;
  height?: number;
  children: React.ReactNode;
  zIndex?: number;
  onFocus?: () => void;
}

const DraggableWindow: React.FC<Props> = ({
  title, isOpen, onClose,
  initialX = 100, initialY = 100,
  width = 400, height = 300,
  children,
  zIndex = 50,
  onFocus
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number, startY: number, initialPosX: number, initialPosY: number } | null>(null);

  if (!isOpen) return null;

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isMaximized) return; // Don't drag when maximized
    if (onFocus) onFocus();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: pos.x,
      initialPosY: pos.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: dragRef.current.initialPosX + dx,
      y: dragRef.current.initialPosY + dy
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  let windowStyle: React.CSSProperties = {
    zIndex,
    width,
    height: isMinimized ? 'auto' : height,
    resize: (isMinimized || isMaximized) ? 'none' : 'both',
    overflow: 'hidden'
  };

  let classes = "fixed flex flex-col panel-glass rounded-xl transition-[width,height] duration-200";

  if (isMaximized) {
    windowStyle = {
      ...windowStyle,
      top: 52, // below toolbar
      left: 0,
      width: '100vw',
      height: 'calc(100vh - 52px)',
      resize: 'none'
    };
    classes += " rounded-none border-0";
  } else {
    windowStyle = {
      ...windowStyle,
      top: pos.y,
      left: pos.x,
    };
  }

  return (
    <div 
      ref={windowRef} 
      className={classes} 
      style={windowStyle}
      onClick={onFocus}
    >
      {/* Title Bar */}
      <div 
        className="h-[36px] bg-[var(--bg-active)] bg-opacity-80 border-b border-[var(--border-light)] flex items-center px-4 select-none flex-shrink-0 rounded-t-xl"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isMaximized ? 'default' : 'grab' }}
      >
        {/* macOS Traffic Lights */}
        <div className="flex space-x-2 mr-4 cursor-pointer" onPointerDown={e => e.stopPropagation()}>
          <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 border border-red-600 flex items-center justify-center group shadow-[0_0_8px_rgba(239,68,68,0.4)]">
            <span className="text-[8px] text-black opacity-0 group-hover:opacity-100 font-bold leading-none">x</span>
          </button>
          <button onClick={() => {setIsMinimized(!isMinimized); setIsMaximized(false);}} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 border border-yellow-600 flex items-center justify-center group shadow-[0_0_8px_rgba(234,179,8,0.4)]">
            <span className="text-[8px] text-black opacity-0 group-hover:opacity-100 font-bold leading-none">-</span>
          </button>
          <button onClick={() => {setIsMaximized(!isMaximized); setIsMinimized(false);}} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 border border-green-600 flex items-center justify-center group shadow-[0_0_8px_rgba(34,197,94,0.4)]">
            <span className="text-[8px] text-black opacity-0 group-hover:opacity-100 font-bold leading-none">+</span>
          </button>
        </div>
        
        <div className="text-xs font-semibold text-white tracking-wider flex-1 text-center pr-10 pointer-events-none drop-shadow-md">
          {title}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-auto bg-transparent relative custom-scrollbar">
          {children}
        </div>
      )}
    </div>
  );
};

export default DraggableWindow;
