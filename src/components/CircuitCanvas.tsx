import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, ShieldAlert, Sliders, Maximize2, Minimize2, X, Columns } from 'lucide-react';
import type { Component, Pin, Wire, SimulationState } from '../types/circuit';

interface CircuitCanvasProps {
  components: Component[];
  wires: Wire[];
  selectedComponentId: string | null;
  activePinIdForWire: string | null;
  simulationState: SimulationState;
  onUpdateComponents: (components: Component[]) => void;
  onUpdateWires: (wires: Wire[]) => void;
  onSelectComponent: (id: string | null) => void;
  onSetActivePinIdForWire: (pinId: string | null) => void;
  
  // Layout Controls
  layoutSwap: boolean;
  onToggleLayoutSwap: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  components,
  wires,
  selectedComponentId,
  activePinIdForWire,
  simulationState,
  onUpdateComponents,
  onUpdateWires,
  onSelectComponent,
  onSetActivePinIdForWire,
  layoutSwap,
  onToggleLayoutSwap,
  isMaximized,
  onToggleMaximize,
  onClose,
}) => {
  const [draggedCompId, setDraggedCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1); // 0.5 to 3
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; wireId: string } | null>(null);
  
  const canvasRef = useRef<SVGSVGElement | null>(null);

  // Escape key — cancel active wire drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSetActivePinIdForWire(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSetActivePinIdForWire]);

  // Scroll-wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.min(3, Math.max(0.4, parseFloat((prev + delta).toFixed(2)))));
  }, []);

  // Right-click on wire — show context menu
  const handleWireRightClick = (e: React.MouseEvent, wireId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, wireId });
  };

  // Close context menu on canvas click
  const handleContextMenuClose = () => setContextMenu(null);

  // Keep track of mouse position on the canvas for drawing the active wire
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (draggedCompId) {
      onUpdateComponents(
        components.map((comp) => {
          if (comp.id === draggedCompId) {
            // Snap to grid of 10px
            const newX = Math.round((x - dragOffset.x) / 10) * 10;
            const newY = Math.round((y - dragOffset.y) / 10) * 10;
            return {
              ...comp,
              x: Math.max(10, Math.min(canvasRef.current!.clientWidth - comp.width - 10, newX)),
              y: Math.max(10, Math.min(canvasRef.current!.clientHeight - comp.height - 10, newY)),
            };
          }
          return comp;
        })
      );
    }
  };

  const handleMouseUp = () => {
    setDraggedCompId(null);
  };

  // Find a pin by its ID
  const findPin = (pinId: string): { comp: Component; pin: Pin } | null => {
    for (const comp of components) {
      const pin = comp.pins.find((p) => p.id === pinId);
      if (pin) return { comp, pin };
    }
    return null;
  };

  // Click on a pin (for wiring)
  const handlePinClick = (e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    if (activePinIdForWire === null) {
      onSetActivePinIdForWire(pinId);
    } else {
      if (activePinIdForWire === pinId) {
        // Cancel wiring if clicked same pin
        onSetActivePinIdForWire(null);
      } else {
        // Complete connection
        const wireExists = wires.some(
          (w) =>
            (w.fromPinId === activePinIdForWire && w.toPinId === pinId) ||
            (w.fromPinId === pinId && w.toPinId === activePinIdForWire)
        );

        if (!wireExists) {
          // Detect wire color based on starting pin type
          const startPin = findPin(activePinIdForWire);
          let color = '#00f0ff'; // Default Cyan
          if (startPin) {
            if (startPin.pin.name === 'GND' || startPin.pin.type === 'ground') {
              color = '#4b5563'; // Dark grey
            } else if (startPin.pin.name === '5V' || startPin.pin.name === '3.3V' || startPin.pin.name === '3V3' || startPin.pin.type === 'power') {
              color = '#ef4444'; // Red
            }
          }

          const newWire: Wire = {
            id: `wire_${Math.random().toString(36).substring(2, 9)}`,
            fromPinId: activePinIdForWire,
            toPinId: pinId,
            color,
          };
          onUpdateWires([...wires, newWire]);
        }
        onSetActivePinIdForWire(null);
      }
    }
  };

  const handleCanvasClick = () => {
    onSelectComponent(null);
    onSetActivePinIdForWire(null);
  };

  // Component Drag Start
  const handleComponentDragStart = (e: React.MouseEvent, compId: string) => {
    e.stopPropagation();
    onSelectComponent(compId);
    const comp = components.find((c) => c.id === compId);
    if (!comp || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setDraggedCompId(compId);
    setDragOffset({
      x: mouseX - comp.x,
      y: mouseY - comp.y,
    });
  };

  const deleteComponent = (compId: string) => {
    onUpdateComponents(components.filter((c) => c.id !== compId));
    onUpdateWires(wires.filter((w) => {
      const fromPin = findPin(w.fromPinId);
      const toPin = findPin(w.toPinId);
      return fromPin && fromPin.comp.id !== compId && toPin && toPin.comp.id !== compId;
    }));
    if (selectedComponentId === compId) {
      onSelectComponent(null);
    }
  };

  const deleteWire = (wireId: string) => {
    onUpdateWires(wires.filter((w) => w.id !== wireId));
  };

  // Toggle button state
  const handleButtonPress = (compId: string, pressed: boolean) => {
    onUpdateComponents(
      components.map((comp) => {
        if (comp.id === compId) {
          return {
            ...comp,
            state: { ...comp.state, isPressed: pressed }
          };
        }
        return comp;
      })
    );
  };

  // Update slider parameters for DHT11 and Potentiometer
  const handleSliderChange = (compId: string, field: string, value: number) => {
    onUpdateComponents(
      components.map((comp) => {
        if (comp.id === compId) {
          if (comp.type === 'potentiometer') {
            const voltage = (value / 100) * 3.3; // simulated 3.3V reference
            return {
              ...comp,
              value,
              state: { ...comp.state, voltage }
            };
          } else if (comp.type === 'dht11') {
            return {
              ...comp,
              state: { ...comp.state, [field]: value }
            };
          }
        }
        return comp;
      })
    );
  };

  // Renders the glowing line paths for wires
  const renderWire = (wire: Wire) => {
    const from = findPin(wire.fromPinId);
    const to = findPin(wire.toPinId);
    if (!from || !to) return null;

    const x1 = from.comp.x + from.pin.x;
    const y1 = from.comp.y + from.pin.y;
    const x2 = to.comp.x + to.pin.x;
    const y2 = to.comp.y + to.pin.y;

    // Organic Bezier wire route calculation
    const dy = Math.abs(y2 - y1);
    
    // Control points pull down slightly to simulate wire slack
    const cp1x = x1;
    const cp1y = y1 + dy * 0.4 + 20;
    const cp2x = x2;
    const cp2y = y2 + dy * 0.4 + 20;

    const pathData = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    // Detect if wire carries active power/logic
    let isWireGlowing = false;
    let glowColor = wire.color;

    if (simulationState.isPlaying) {
      const fromVolt = simulationState.pinVoltages[wire.fromPinId] || 0;
      const toVolt = simulationState.pinVoltages[wire.toPinId] || 0;
      const activeVoltage = Math.max(fromVolt, toVolt);
      if (activeVoltage > 1.5) {
        isWireGlowing = true;
        glowColor = activeVoltage > 4.0 ? '#ef4444' : '#00f0ff'; // Red for 5V, Cyan for 3.3V/GPIO
      }
    }

    return (
      <g key={wire.id} className="wire-group">
        {/* Thick transparent interactive path for easier double/right clicking */}
        <path
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          style={{ cursor: 'context-menu' }}
          onDoubleClick={() => deleteWire(wire.id)}
          onContextMenu={(e) => handleWireRightClick(e, wire.id)}
        >
          <title>Double-click or right-click to delete wire</title>
        </path>
        {/* Glow backdrop path */}
        {isWireGlowing && (
          <path
            d={pathData}
            fill="none"
            stroke={glowColor}
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.4"
            style={{ filter: 'blur(3px)' }}
          />
        )}
        {/* Primary wire path */}
        <path
          d={pathData}
          fill="none"
          stroke={glowColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          onDoubleClick={() => deleteWire(wire.id)}
          style={{ transition: 'stroke 0.2s' }}
        />
      </g>
    );
  };

  return (
    <div className="canvas-pane" style={{ order: layoutSwap ? 1 : 2 }}>
      <div className="pane-header">
        <div className="pane-title">
          <Sliders size={14} className="text-cyan-400" />
          <span>Interactive Circuit Sandbox</span>
        </div>
        <div className="pane-controls">
          <button className="panel-toggle-btn" onClick={onToggleLayoutSwap} data-tooltip="Swap Panel Left/Right">
            <Columns size={12} />
          </button>
          <button className="panel-toggle-btn" onClick={onToggleMaximize} data-tooltip={isMaximized ? "Restore Layout" : "Maximize Panel"}>
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {/* Zoom Controls */}
          <div className="zoom-controls" data-tooltip={`Zoom: ${Math.round(zoom * 100)}%`}>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.1).toFixed(2))))}>+</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(2))))}>-</button>
            <button className="zoom-btn zoom-reset" onClick={() => setZoom(1)} data-tooltip="Reset Zoom">⊙</button>
          </div>
          {selectedComponentId && (
            <button
              className="btn btn-danger btn-icon"
              onClick={() => deleteComponent(selectedComponentId)}
              data-tooltip="Delete selected component"
              style={{ padding: '4px', borderRadius: '4px', marginLeft: '6px' }}
            >
              <Trash2 size={12} />
            </button>
          )}
          <button className="panel-close-btn" onClick={onClose} data-tooltip="Close Panel" style={{ marginLeft: '6px' }}>
            <X size={12} />
          </button>
        </div>
      </div>

      <svg
        ref={canvasRef}
        className="sandbox-svg"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={() => { handleCanvasClick(); handleContextMenuClose(); }}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`scale(${zoom})`}>
        {/* Glow Filters */}
        <defs>
          <filter id="led-glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="led-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Wires */}
        {wires.map(renderWire)}

        {/* Active temporary wire */}
        {activePinIdForWire && (() => {
          const pinData = findPin(activePinIdForWire);
          if (!pinData) return null;
          const x1 = pinData.comp.x + pinData.pin.x;
          const y1 = pinData.comp.y + pinData.pin.y;
          return (
            <line
              x1={x1}
              y1={y1}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="#00f0ff"
              strokeWidth="2"
              strokeDasharray="4,4"
            />
          );
        })()}

        {/* Render Components */}
        {components.map((comp) => {
          const isSelected = selectedComponentId === comp.id;
          
          return (
            <g
              key={comp.id}
              transform={`translate(${comp.x}, ${comp.y})`}
              onMouseDown={(e) => handleComponentDragStart(e, comp.id)}
              style={{ cursor: draggedCompId === comp.id ? 'grabbing' : 'grab' }}
            >
              {/* Component Outline / Glow border when selected */}
              <rect
                x="-3"
                y="-3"
                width={comp.width + 6}
                height={comp.height + 6}
                rx="8"
                fill="transparent"
                stroke={isSelected ? 'var(--color-accent)' : 'transparent'}
                strokeWidth="1.5"
                strokeDasharray={isSelected ? '4, 2' : 'none'}
              />

              {/* RENDER SPECIFIC COMPONENTS */}
              
              {/* 1. Arduino Uno R3 */}
              {comp.type === 'mcu' && comp.model === 'uno' && (
                <g>
                  {/* Board Body */}
                  <rect width={comp.width} height={comp.height} rx="8" fill="#1e3a5f" stroke="#2563eb" strokeWidth="2" />
                  <rect x="10" y="10" width={comp.width - 20} height={comp.height - 20} rx="6" fill="#1b304f" />
                  
                  {/* Microcontroller chip */}
                  <rect x="90" y="70" width="100" height="25" rx="2" fill="#111827" stroke="#374151" />
                  {/* Chip pin markings */}
                  {Array.from({ length: 14 }).map((_, i) => (
                    <g key={i}>
                      <line x1={95 + i * 7} y1={66} x2={95 + i * 7} y2={70} stroke="#9ca3af" strokeWidth="1.5" />
                      <line x1={95 + i * 7} y1={95} x2={95 + i * 7} y2={99} stroke="#9ca3af" strokeWidth="1.5" />
                    </g>
                  ))}
                  <text x="140" y="86" fill="#4b5563" fontSize="8" fontFamily="monospace" textAnchor="middle">ATMEGA328P</text>
                  
                  {/* Voltage regulator and USB socket visuals */}
                  <rect x="5" y="25" width="40" height="35" rx="3" fill="#374151" />
                  <rect x="5" y="100" width="30" height="35" rx="2" fill="#0f172a" />
                  
                  {/* Board Labels */}
                  <text x={comp.width / 2} y={120} fill="rgba(255,255,255,0.15)" fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">ARDUINO UNO R3</text>

                  {/* Pin Header Visual Backgrounds */}
                  <rect x="30" y="10" width="202" height="12" fill="#111" rx="2" />
                  <rect x="30" y="138" width="76" height="12" fill="#111" rx="2" />
                  <rect x="120" y="138" width="76" height="12" fill="#111" rx="2" />
                </g>
              )}

              {/* 2. ESP32 DevKit v1 */}
              {comp.type === 'mcu' && comp.model === 'esp32' && (
                <g>
                  {/* Board Body */}
                  <rect width={comp.width} height={comp.height} rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                  <rect x="8" y="8" width={comp.width - 16} height={comp.height - 16} rx="6" fill="#0f172a" />
                  
                  {/* ESP32 module box */}
                  <rect x="30" y="20" width="80" height="70" rx="4" fill="#334155" stroke="#475569" />
                  <rect x="40" y="25" width="60" height="35" rx="2" fill="#1e293b" />
                  {/* WiFi Antenna line */}
                  <path d="M 45 65 L 95 65 M 45 70 L 95 70 M 55 65 L 55 80 M 65 65 L 65 80 M 75 65 L 75 80 M 85 65 L 85 80" stroke="#f1f5f9" strokeWidth="1" />
                  <text x="70" y="47" fill="#cbd5e1" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ESP-WROOM-32</text>
                  
                  {/* Silicon core and buttons */}
                  <rect x="50" y="110" width="40" height="40" rx="4" fill="#1e293b" />
                  <circle cx="28" cy="170" r="5" fill="#475569" />
                  <circle cx="112" cy="170" r="5" fill="#475569" />
                  <text x="28" y="185" fill="#94a3b8" fontSize="6" textAnchor="middle">EN</text>
                  <text x="112" y="185" fill="#94a3b8" fontSize="6" textAnchor="middle">BOOT</text>

                  {/* Brand logo */}
                  <text x="70" y="180" fill="rgba(255,255,255,0.1)" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">ESP32</text>

                  {/* Pin Headers */}
                  <rect x="10" y="30" width="10" height="155" fill="#111" rx="2" />
                  <rect x="120" y="30" width="10" height="155" fill="#111" rx="2" />
                </g>
              )}

              {/* 3. LED Component */}
              {comp.type === 'led' && (() => {
                const isOn = comp.state?.isOn;
                const color = comp.name.includes('Green') ? 'green' : 'red';
                const ledColor = color === 'green' ? '#00ff88' : '#ff4d4d';
                const baseColor = color === 'green' ? '#047857' : '#be123c';
                const filterId = color === 'green' ? 'url(#led-glow-green)' : 'url(#led-glow-red)';
                
                return (
                  <g>
                    {/* Metal Pins */}
                    <line x1="13" y1="35" x2="13" y2="52" stroke="#94a3b8" strokeWidth="2.5" />
                    <line x1="27" y1="35" x2="27" y2="52" stroke="#94a3b8" strokeWidth="2.5" />
                    
                    {/* Plastic holder */}
                    <rect x="5" y="32" width="30" height="6" fill="#374151" rx="1" />

                    {/* LED Dome Body */}
                    <path
                      d="M 5 32 L 5 20 A 15 15 0 0 1 35 20 L 35 32 Z"
                      fill={isOn ? ledColor : baseColor}
                      stroke={isOn ? '#fff' : 'rgba(0,0,0,0.3)'}
                      strokeWidth="1.5"
                      style={isOn ? { filter: filterId } : {}}
                    />
                    {/* Inner filament */}
                    <path d="M 12 30 L 15 22 L 25 22 L 28 30" fill="none" stroke="#fff" opacity={isOn ? 0.9 : 0.2} strokeWidth="1" />
                    <text x="20" y="-8" fill="#cbd5e1" fontSize="10" fontWeight="bold" textAnchor="middle">{comp.name}</text>
                  </g>
                );
              })()}

              {/* 4. Resistor Component */}
              {comp.type === 'resistor' && (
                <g>
                  {/* Metal leads */}
                  <line x1="0" y1="12" x2="15" y2="12" stroke="#94a3b8" strokeWidth="2" />
                  <line x1="55" y1="12" x2="70" y2="12" stroke="#94a3b8" strokeWidth="2" />
                  
                  {/* Resistor Body */}
                  <rect x="15" y="4" width="40" height="16" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
                  
                  {/* Color Bands (220 Ohm standard: Red, Red, Brown, Gold) */}
                  <rect x="22" y="4" width="3.5" height="16" fill="#ef4444" />
                  <rect x="29" y="4" width="3.5" height="16" fill="#ef4444" />
                  <rect x="36" y="4" width="3.5" height="16" fill="#78350f" />
                  <rect x="47" y="4" width="3.5" height="16" fill="#fbbf24" />

                  <text x="35" y="-8" fill="#cbd5e1" fontSize="9" fontWeight="500" textAnchor="middle">220 Ω</text>
                </g>
              )}

              {/* 5. Push Button Component */}
              {comp.type === 'button' && (() => {
                const pressed = comp.state?.isPressed;
                return (
                  <g>
                    {/* Metal legs */}
                    <line x1="0" y1="22" x2="8" y2="22" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="36" y1="22" x2="44" y2="22" stroke="#94a3b8" strokeWidth="2" />
                    
                    {/* Plastic Body Case */}
                    <rect width="36" x="4" y="4" height="36" rx="4" fill="#374151" stroke="#1f2937" strokeWidth="2" />
                    
                    {/* Button Plunger */}
                    <circle
                      cx="22"
                      cy="22"
                      r={pressed ? 10 : 12}
                      fill={pressed ? '#ef4444' : '#b91c1c'}
                      stroke="#450a0a"
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleButtonPress(comp.id, true);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        handleButtonPress(comp.id, false);
                      }}
                      onMouseLeave={() => {
                        if (pressed) handleButtonPress(comp.id, false);
                      }}
                    />
                    
                    {/* Internal metal tabs */}
                    <rect x="19" y="19" width="6" height="6" fill="#d1d5db" opacity="0.3" />
                    <text x="22" y="-8" fill="#cbd5e1" fontSize="9" fontWeight="500" textAnchor="middle">Button</text>
                  </g>
                );
              })()}

              {/* 6. Potentiometer Component */}
              {comp.type === 'potentiometer' && (() => {
                const angle = ((comp.value || 0) / 100) * 270 - 135; // map 0-100 to -135 to 135 deg
                return (
                  <g>
                    {/* Dial casing */}
                    <circle cx="25" cy="25" r="22" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    {/* Core wiper */}
                    <circle cx="25" cy="25" r="16" fill="#334155" />
                    {/* Dial pointer notch */}
                    <g transform={`rotate(${angle}, 25, 25)`}>
                      <line x1="25" y1="25" x2="25" y2="11" stroke="#00f0ff" strokeWidth="3.5" strokeLinecap="round" />
                    </g>
                    
                    {/* Dial track markings */}
                    <path d="M 12 40 A 18 18 0 1 1 38 40" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />

                    {/* Legs casing */}
                    <rect x="8" y="47" width="34" height="15" fill="#374151" rx="2" />
                    {/* Component Leads */}
                    <line x1="12" y1="52" x2="12" y2="62" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="25" y1="52" x2="25" y2="62" stroke="#94a3b8" strokeWidth="2" />
                    <line x1="38" y1="52" x2="38" y2="62" stroke="#94a3b8" strokeWidth="2" />

                    <text x="25" y="-8" fill="#cbd5e1" fontSize="9" fontWeight="500" textAnchor="middle">Pot ({comp.value}%)</text>
                  </g>
                );
              })()}

              {/* 7. DHT11 Sensor Component */}
              {comp.type === 'dht11' && (
                <g>
                  {/* Grid Casing blue */}
                  <rect width={comp.width} height={50} rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
                  
                  {/* Grille holes */}
                  {Array.from({ length: 4 }).map((_, r) => (
                    Array.from({ length: 4 }).map((_, c) => (
                      <rect
                        key={`${r}-${c}`}
                        x={8 + c * 10}
                        y={8 + r * 10}
                        width="6"
                        height="5"
                        fill="#0c4a6e"
                        rx="1"
                      />
                    ))
                  ))}

                  {/* Header connectors spacer */}
                  <rect x="8" y="50" width="38" height="12" fill="#374151" />
                  {/* Pins */}
                  <line x1="13" y1="55" x2="13" y2="62" stroke="#94a3b8" strokeWidth="2" />
                  <line x1="27" y1="55" x2="27" y2="62" stroke="#94a3b8" strokeWidth="2" />
                  <line x1="41" y1="55" x2="41" y2="62" stroke="#94a3b8" strokeWidth="2" />

                  <text x="27" y="-8" fill="#cbd5e1" fontSize="9" fontWeight="500" textAnchor="middle">
                    DHT11 ({comp.state?.temperature}°C, {comp.state?.humidity}%)
                  </text>
                </g>
              )}

              {/* 8. Breadboard */}
              {comp.type === 'breadboard' && (
                <g>
                  <rect width={comp.width} height={comp.height} rx="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
                  
                  {/* Central gutter channel divider */}
                  <rect x="10" y="65" width={comp.width - 20} height="10" fill="#e2e8f0" />
                  
                  {/* Draw power rail lines */}
                  <line x1="15" y1="12" x2={comp.width - 15} y2="12" stroke="#ef4444" strokeWidth="1.5" />
                  <line x1="15" y1="24" x2={comp.width - 15} y2="24" stroke="#2563eb" strokeWidth="1.5" />
                  <line x1="15" y1="116" x2={comp.width - 15} y2="116" stroke="#ef4444" strokeWidth="1.5" />
                  <line x1="15" y1="128" x2={comp.width - 15} y2="128" stroke="#2563eb" strokeWidth="1.5" />

                  {/* Breadboard Hole Grids (Representational visual only) */}
                  {Array.from({ length: 30 }).map((_, col) => {
                    const cx = 25 + col * 15;
                    return (
                      <g key={col}>
                        {/* Upper grid */}
                        <circle cx={cx} cy="38" r="1.5" fill="#475569" />
                        <circle cx={cx} cy="48" r="1.5" fill="#475569" />
                        <circle cx={cx} cy="58" r="1.5" fill="#475569" />
                        {/* Lower grid */}
                        <circle cx={cx} cy="82" r="1.5" fill="#475569" />
                        <circle cx={cx} cy="92" r="1.5" fill="#475569" />
                        <circle cx={cx} cy="102" r="1.5" fill="#475569" />
                      </g>
                    );
                  })}
                  
                  <text x={comp.width / 2} y="137" fill="#94a3b8" fontSize="8" fontFamily="sans-serif" textAnchor="middle">HALF-SIZE BREADBOARD</text>
                </g>
              )}

              {/* PINS RENDERING (Draw for all interactive components except Breadboards) */}
              {comp.type !== 'breadboard' && comp.pins.map((pin) => {
                const isPinActive = activePinIdForWire === pin.id;
                
                // Show voltage indicator dot inside pins
                let voltageColor = 'transparent';
                if (simulationState.isPlaying) {
                  const volt = simulationState.pinVoltages[pin.id] || 0;
                  if (volt > 2.5) voltageColor = '#ff4d4d'; // logic HIGH (Red)
                  else if (volt > 0.5) voltageColor = '#00f0ff'; // logic active (Cyan)
                }

                return (
                  <g
                    key={pin.id}
                    className="pin-element"
                    onClick={(e) => handlePinClick(e, pin.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Invisible larger click area for ease of use */}
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r="9"
                      fill="transparent"
                    />
                    {/* Outline metal circle */}
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r="4"
                      fill="#e2e8f0"
                      stroke={isPinActive ? 'var(--color-accent)' : '#475569'}
                      strokeWidth="1.5"
                    />
                    {/* Inner logic indicator */}
                    {voltageColor !== 'transparent' && (
                      <circle
                        cx={pin.x}
                        cy={pin.y}
                        r="2"
                        fill={voltageColor}
                      />
                    )}
                    
                    {/* Small text label next to the pin, only show for microcontrollers */}
                    {comp.type === 'mcu' && (
                      <text
                        x={pin.x + (pin.x < comp.width / 2 ? 6 : -6)}
                        y={pin.y + 3}
                        fill="#94a3b8"
                        fontSize="6"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor={pin.x < comp.width / 2 ? 'start' : 'end'}
                        pointerEvents="none"
                      >
                        {pin.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        </g>{/* end zoom group */}
      </svg>

      {/* Right-click context menu for wires */}
      {contextMenu && (
        <div
          className="wire-context-menu"
          style={{ top: contextMenu.y - 20, left: contextMenu.x - 20 }}
          onMouseLeave={handleContextMenuClose}
        >
          <button
            className="context-menu-item danger"
            onClick={() => {
              deleteWire(contextMenu.wireId);
              setContextMenu(null);
            }}
          >
            🗑️ Delete Wire
          </button>
          <button className="context-menu-item" onClick={handleContextMenuClose}>
            Cancel
          </button>
        </div>
      )}

      {/* Floating sliders for active component properties (DHT11, Potentiometer) */}
      {selectedComponentId && (() => {
        const comp = components.find((c) => c.id === selectedComponentId);
        if (!comp) return null;

        if (comp.type === 'potentiometer') {
          return (
            <div className="floating-panel">
              <h4 className="floating-panel-title">Potentiometer Settings</h4>
              <div className="slider-group">
                <div className="slider-row">
                  <label className="slider-label">Analog Output Wiper: {comp.value}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comp.value || 0}
                    className="slider-input"
                    onChange={(e) => handleSliderChange(comp.id, 'value', parseInt(e.target.value))}
                  />
                  <div className="slider-subtext">
                    <span>0V (GND)</span>
                    <span>1.65V (Mid)</span>
                    <span>3.3V (VCC)</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (comp.type === 'dht11') {
          return (
            <div className="floating-panel">
              <h4 className="floating-panel-title">DHT11 Sensor Input</h4>
              <div className="slider-group">
                <div className="slider-row">
                  <label className="slider-label">Temperature: {comp.state?.temperature || 24}°C</label>
                  <input
                    type="range"
                    min="-10"
                    max="60"
                    value={comp.state?.temperature || 24}
                    className="slider-input"
                    onChange={(e) => handleSliderChange(comp.id, 'temperature', parseInt(e.target.value))}
                  />
                </div>
                <div className="slider-row">
                  <label className="slider-label">Humidity: {comp.state?.humidity || 45}%</label>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    value={comp.state?.humidity || 45}
                    className="slider-input"
                    onChange={(e) => handleSliderChange(comp.id, 'humidity', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* Floating help tooltip for wiring */}
      {activePinIdForWire && (
        <div className="wiring-tooltip">
          <ShieldAlert size={14} />
          <span>Click target pin to complete wire. <kbd>Double-click</kbd> or <kbd>Right-click</kbd> wire to delete. <kbd>Esc</kbd> to cancel.</span>
        </div>
      )}
    </div>
  );
};
