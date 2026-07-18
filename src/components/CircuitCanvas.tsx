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
              
              {/* 1. Arduino Uno R3 — SpaceX Dark PCB look */}
              {comp.type === 'mcu' && comp.model === 'uno' && (
                <g>
                  {/* PCB Base — SpaceX style dark monochrome */}
                  <rect width={comp.width} height={comp.height} rx="6" fill="#121212" stroke="#27272a" strokeWidth="2" />
                  <rect x="3" y="3" width={comp.width - 6} height={comp.height - 6} rx="5" fill="#18181b" />

                  {/* USB-B Connector */}
                  <rect x="4" y="28" width="22" height="20" rx="2" fill="#2d2d30" stroke="#444" strokeWidth="1" />
                  <rect x="7" y="31" width="16" height="14" rx="1" fill="#111" />
                  <text x="15" y="55" fill="#a1a1aa" fontSize="6" fontFamily="monospace" textAnchor="middle">USB-B</text>

                  {/* DC Barrel Jack */}
                  <circle cx="15" cy="105" r="10" fill="#222" stroke="#444" strokeWidth="1.5" />
                  <circle cx="15" cy="105" r="5" fill="#333" />
                  <circle cx="15" cy="105" r="2" fill="#111" />
                  <text x="15" y="120" fill="#a1a1aa" fontSize="5" fontFamily="monospace" textAnchor="middle">DC IN</text>

                  {/* ATmega328P chip */}
                  <rect x="88" y="62" width="106" height="32" rx="3" fill="#09090b" stroke="#27272a" strokeWidth="1" />
                  {Array.from({ length: 14 }).map((_, i) => (
                    <g key={i}>
                      <rect x={92 + i * 7} y={59} width={4} height={5} fill="#3f3f46" rx="0.5" />
                      <rect x={92 + i * 7} y={94} width={4} height={5} fill="#3f3f46" rx="0.5" />
                    </g>
                  ))}
                  <text x="141" y="80" fill="#e4e4e7" fontSize="7" fontFamily="monospace" textAnchor="middle">ATMEGA328P</text>
                  <text x="141" y="89" fill="#52525b" fontSize="5" fontFamily="monospace" textAnchor="middle">16MHz  5V</text>

                  {/* Voltage regulator */}
                  <rect x="215" y="62" width="14" height="22" rx="1" fill="#222" stroke="#333" strokeWidth="1" />
                  <rect x="217" y="55" width="3" height="9" fill="#444" />
                  <rect x="221" y="55" width="3" height="9" fill="#444" />
                  <rect x="225" y="55" width="3" height="9" fill="#444" />
                  <text x="222" y="92" fill="#71717a" fontSize="5" fontFamily="monospace" textAnchor="middle">7805</text>

                  {/* Crystal Oscillator */}
                  <rect x="200" y="88" width="8" height="18" rx="3" fill="#2d2d30" stroke="#444" strokeWidth="1" />
                  <text x="204" y="112" fill="#71717a" fontSize="4" fontFamily="monospace" textAnchor="middle">16M</text>

                  {/* Reset button */}
                  <rect x="56" y="60" width="14" height="12" rx="2" fill="#222" stroke="#444" />
                  <circle cx="63" cy="66" r="4" fill="#3f3f46" />
                  <text x="63" y="78" fill="#71717a" fontSize="5" fontFamily="monospace" textAnchor="middle">RST</text>

                  {/* Power LED */}
                  <ellipse cx="58" cy="120" rx="3" ry="4" fill="#e4e4e7" opacity="0.9" />
                  <text x="58" y="130" fill="#71717a" fontSize="5" fontFamily="monospace" textAnchor="middle">PWR</text>

                  {/* ICSP Header */}
                  <rect x="154" y="100" width="16" height="14" rx="1" fill="#111" stroke="#333" />
                  {[0,1,2].map(r => [0,1].map(c => (
                    <circle key={`${r}${c}`} cx={156 + c * 6} cy={103 + r * 4.5} r="1.5" fill="#444" />
                  )))}
                  <text x="162" y="120" fill="#71717a" fontSize="5" fontFamily="monospace" textAnchor="middle">ICSP</text>

                  {/* Silkscreen label */}
                  <text x={comp.width / 2 + 10} y="120" fill="rgba(255,255,255,0.06)" fontSize="14" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">ARDUINO</text>
                  <text x={comp.width / 2 + 10} y="133" fill="rgba(255,255,255,0.04)" fontSize="10" fontFamily="sans-serif" textAnchor="middle">UNO R3</text>

                  {/* Digital pin header bar */}
                  <rect x="32" y="9" width="202" height="10" fill="#09090b" rx="2" />
                  {Array.from({ length: 18 }).map((_, i) => (
                    <rect key={i} x={35 + i * 11} y={7} width={5} height={5} rx="1" fill="#18181b" stroke="#27272a" strokeWidth="0.5" />
                  ))}

                  {/* Analog + Power pin header bar */}
                  <rect x="32" y="139" width="76" height="10" fill="#09090b" rx="2" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <rect key={`pwr-${i}`} x={35 + i * 11} y={142} width={5} height={5} rx="1" fill="#18181b" stroke="#27272a" strokeWidth="0.5" />
                  ))}
                  
                  <rect x="120" y="139" width="76" height="10" fill="#09090b" rx="2" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <rect key={`analog-${i}`} x={123 + i * 11} y={142} width={5} height={5} rx="1" fill="#18181b" stroke="#27272a" strokeWidth="0.5" />
                  ))}
                </g>
              )}

              {/* 2. ESP32 DevKit v1 — SpaceX Dark PCB look */}
              {comp.type === 'mcu' && comp.model === 'esp32' && (
                <g>
                  {/* PCB Base — SpaceX style dark monochrome */}
                  <rect width={comp.width} height={comp.height} rx="6" fill="#121212" stroke="#27272a" strokeWidth="2" />
                  <rect x="3" y="3" width={comp.width - 6} height={comp.height - 6} rx="5" fill="#18181b" />

                  {/* ESP-WROOM-32 module — dark metallic shield */}
                  <rect x="22" y="15" width="96" height="68" rx="4" fill="#2d2d30" stroke="#444" strokeWidth="1.5" />
                  <rect x="24" y="17" width="92" height="64" rx="3" fill="#3f3f46" />

                  {/* Module inner chip area */}
                  <rect x="35" y="22" width="70" height="38" rx="2" fill="#18181b" />
                  <rect x="42" y="27" width="56" height="28" rx="1" fill="#09090b" />

                  {/* Chip marking */}
                  <text x="70" y="44" fill="#71717a" fontSize="7" fontFamily="monospace" textAnchor="middle">ESP32-D0WDQ6</text>
                  <text x="70" y="53" fill="#52525b" fontSize="5" fontFamily="monospace" textAnchor="middle">4MB FLASH</text>

                  {/* WiFi Antenna trace pattern */}
                  <path d="M 28 88 L 28 62 L 35 62" fill="none" stroke="#27272a" strokeWidth="1.5" />
                  <path d="M 26 78 L 22 78" fill="none" stroke="#27272a" strokeWidth="1" />
                  <path d="M 26 72 L 20 72" fill="none" stroke="#27272a" strokeWidth="1" />
                  <path d="M 26 66 L 22 66" fill="none" stroke="#27272a" strokeWidth="1" />

                  {/* ESP-WROOM-32 label */}
                  <text x="70" y="90" fill="#71717a" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ESP-WROOM-32</text>

                  {/* Monochrome trace lines */}
                  <line x1="25" y1="110" x2="115" y2="110" stroke="#27272a" strokeWidth="0.8" opacity="0.3" />
                  <line x1="25" y1="130" x2="115" y2="130" stroke="#27272a" strokeWidth="0.8" opacity="0.3" />

                  {/* Silicon die */}
                  <rect x="42" y="110" width="56" height="42" rx="3" fill="#09090b" stroke="#27272a" />
                  <rect x="50" y="116" width="40" height="30" rx="2" fill="#18181b" />

                  {/* EN + BOOT buttons */}
                  <rect x="20" y="165" width="14" height="9" rx="2" fill="#2d2d30" stroke="#444" />
                  <circle cx="27" cy="169.5" r="3.5" fill="#18181b" />
                  <circle cx="27" cy="169.5" r="2" fill="#52525b" />
                  <text x="27" y="180" fill="#71717a" fontSize="6" textAnchor="middle" fontFamily="monospace">EN</text>

                  <rect x="106" y="165" width="14" height="9" rx="2" fill="#2d2d30" stroke="#444" />
                  <circle cx="113" cy="169.5" r="3.5" fill="#18181b" />
                  <circle cx="113" cy="169.5" r="2" fill="#52525b" />
                  <text x="113" y="180" fill="#71717a" fontSize="6" textAnchor="middle" fontFamily="monospace">BOOT</text>

                  {/* Micro USB connector */}
                  <rect x="50" y="185" width="40" height="12" rx="2" fill="#2d2d30" stroke="#444" />
                  <rect x="54" y="187" width="32" height="8" rx="1" fill="#111" />
                  <text x="70" y="205" fill="#71717a" fontSize="5.5" fontFamily="monospace" textAnchor="middle">microUSB</text>

                  {/* Silkscreen */}
                  <text x="70" y="160" fill="rgba(255,255,255,0.06)" fontSize="13" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">ESP32</text>

                  {/* Pin header strips */}
                  <rect x="8" y="25" width="10" height="172" fill="#09090b" rx="2" />
                  <rect x="122" y="25" width="10" height="172" fill="#09090b" rx="2" />
                  {/* Individual pin squares aligned with logical pins */}
                  {Array.from({ length: 15 }).map((_, i) => (
                    <g key={i}>
                      <rect x={9} y={32 + i * 11} width={8} height={6} rx="0.5" fill="#18181b" stroke="#27272a" strokeWidth="0.5" />
                      <rect x={123} y={32 + i * 11} width={8} height={6} rx="0.5" fill="#18181b" stroke="#27272a" strokeWidth="0.5" />
                    </g>
                  ))}
                </g>
              )}

              {/* 3. LED — Realistic bullet-dome LED */}
              {comp.type === 'led' && (() => {
                const isOn = comp.state?.isOn;
                const brightness = comp.state?.brightness ?? 255;
                const opacity = isOn ? (0.4 + (brightness / 255) * 0.6) : 1;
                const color = comp.name.toLowerCase().includes('green') ? 'green'
                  : comp.name.toLowerCase().includes('yellow') ? 'yellow'
                  : comp.name.toLowerCase().includes('blue') ? 'blue'
                  : 'red';

                const palette: Record<string, { body: string; on: string; glow: string; filter: string }> = {
                  red:    { body: '#7f1d1d', on: '#ff4444', glow: '#ff2222', filter: 'url(#led-glow-red)' },
                  green:  { body: '#14532d', on: '#22ff88', glow: '#00ff66', filter: 'url(#led-glow-green)' },
                  yellow: { body: '#78350f', on: '#ffd700', glow: '#ffcc00', filter: 'url(#led-glow-red)' },
                  blue:   { body: '#1e3a5f', on: '#66aaff', glow: '#4499ff', filter: 'url(#led-glow-green)' },
                };
                const p = palette[color];
                const bodyFill = isOn ? p.on : p.body;

                return (
                  <g>
                    {/* Metal leads */}
                    <line x1="14" y1="42" x2="14" y2="56" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="26" y1="42" x2="26" y2="56" stroke="#b0b8c0" strokeWidth="2" />
                    {/* Shorter anode leg indicator */}
                    <line x1="14" y1="50" x2="11" y2="50" stroke="#b0b8c0" strokeWidth="1.5" />

                    {/* Lead spacer/base */}
                    <rect x="7" y="38" width="26" height="5" rx="1" fill="#374151" />

                    {/* LED cylindrical body — flat bottom */}
                    <rect x="7" y="18" width="26" height="22" rx="0" fill={bodyFill}
                      style={isOn ? { filter: p.filter, opacity } : { opacity: 0.85 }} />

                    {/* LED dome cap */}
                    <ellipse cx="20" cy="18" rx="13" ry="10"
                      fill={isOn ? p.on : p.body}
                      style={isOn ? { filter: p.filter, opacity } : { opacity: 0.85 }} />

                    {/* Lens glint/reflection */}
                    <ellipse cx="15" cy="13" rx="4" ry="3"
                      fill="rgba(255,255,255,0.35)" />
                    <ellipse cx="14" cy="12" rx="1.5" ry="1"
                      fill="rgba(255,255,255,0.5)" />

                    {/* Glow halo when on */}
                    {isOn && (
                      <ellipse cx="20" cy="18" rx="16" ry="13"
                        fill={p.glow} opacity="0.12" style={{ filter: 'blur(4px)' }} />
                    )}

                    {/* Polarity marks */}
                    <text x="13" y="54" fill="#64748b" fontSize="6" textAnchor="middle">+</text>
                    <text x="27" y="54" fill="#64748b" fontSize="6" textAnchor="middle">-</text>

                    <text x="20" y="-6" fill="#94a3b8" fontSize="9.5" fontWeight="600" textAnchor="middle">{comp.name}</text>
                    {isOn && <text x="20" y="3" fill={p.glow} fontSize="7" textAnchor="middle">●</text>}
                  </g>
                );
              })()}

              {/* 4. Resistor — Realistic ceramic body with proper color bands */}
              {comp.type === 'resistor' && (
                <g>
                  {/* Metal leads with bend */}
                  <line x1="0" y1="13" x2="13" y2="13" stroke="#b0b8c0" strokeWidth="2" />
                  <line x1="57" y1="13" x2="70" y2="13" stroke="#b0b8c0" strokeWidth="2" />

                  {/* Resistor ceramic body — beige/tan */}
                  <rect x="13" y="5" width="44" height="16" rx="7" fill="#d4b896" stroke="#b8976e" strokeWidth="1" />
                  {/* Inner lighter band on ends (realistic ceramic cap look) */}
                  <rect x="13" y="5" width="7" height="16" rx="5" fill="#c8a87a" />
                  <rect x="50" y="5" width="7" height="16" rx="5" fill="#c8a87a" />

                  {/* Color bands: 220Ω = Red(2) Red(2) Brown(×10) Gold(5%) */}
                  {/* Band 1: Red */}
                  <rect x="21" y="5" width="4" height="16" fill="#dc2626" />
                  {/* Band 2: Red */}
                  <rect x="28" y="5" width="4" height="16" fill="#dc2626" />
                  {/* Band 3: Brown (multiplier) */}
                  <rect x="35" y="5" width="4" height="16" fill="#7c3f00" />
                  {/* Band 4: Gold (tolerance) — spaced right */}
                  <rect x="46" y="5" width="3" height="16" fill="#d4a017" />

                  {/* Body sheen — top highlight */}
                  <rect x="14" y="5" width="42" height="4" rx="3" fill="rgba(255,255,255,0.18)" />

                  {/* Value label */}
                  <text x="35" y="-5" fill="#94a3b8" fontSize="9" fontWeight="500" textAnchor="middle">220 Ω</text>
                </g>
              )}

              {/* 5. Push Button — Realistic tactile switch */}
              {comp.type === 'button' && (() => {
                const pressed = comp.state?.isPressed;
                return (
                  <g>
                    {/* 4 metal legs */}
                    <line x1="8" y1="44" x2="8" y2="56" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="36" y1="44" x2="36" y2="56" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="8" y1="8" x2="8" y2="0" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="36" y1="8" x2="36" y2="0" stroke="#b0b8c0" strokeWidth="2" />

                    {/* Plastic body — dark grey square */}
                    <rect x="0" y="8" width="44" height="38" rx="3" fill="#1c1c1e" stroke="#3a3a3c" strokeWidth="1.5" />
                    {/* Inner metal ring */}
                    <circle cx="22" cy="26" r="16" fill="#2a2a2c" stroke="#444" strokeWidth="1" />
                    {/* Outer plunger ring */}
                    <circle cx="22" cy="26" r="12"
                      fill={pressed ? '#1a1a1a' : '#252527'}
                      stroke={pressed ? '#666' : '#555'}
                      strokeWidth="1.5" />
                    {/* Cap */}
                    <circle
                      cx="22"
                      cy={pressed ? 26 : 24}
                      r="9"
                      fill={pressed ? '#b91c1c' : '#ef4444'}
                      stroke={pressed ? '#7f1d1d' : '#dc2626'}
                      strokeWidth="1"
                      style={{ cursor: 'pointer', transition: 'cy 0.05s' }}
                      onMouseDown={(e) => { e.stopPropagation(); handleButtonPress(comp.id, true); }}
                      onMouseUp={(e) => { e.stopPropagation(); handleButtonPress(comp.id, false); }}
                      onMouseLeave={() => { if (pressed) handleButtonPress(comp.id, false); }}
                    />
                    {/* Cap glint */}
                    <ellipse cx="18" cy={pressed ? 22 : 21} rx="3" ry="2"
                      fill="rgba(255,255,255,0.2)" />
                    {/* Body corner screws */}
                    <circle cx="4" cy="12" r="2" fill="#333" stroke="#555" strokeWidth="0.5" />
                    <circle cx="40" cy="12" r="2" fill="#333" stroke="#555" strokeWidth="0.5" />
                    <circle cx="4" cy="42" r="2" fill="#333" stroke="#555" strokeWidth="0.5" />
                    <circle cx="40" cy="42" r="2" fill="#333" stroke="#555" strokeWidth="0.5" />

                    <text x="22" y="-6" fill="#94a3b8" fontSize="9" fontWeight="500" textAnchor="middle">Button</text>
                    {pressed && <text x="22" y="-6" fill="#22c55e" fontSize="9" fontWeight="700" textAnchor="middle">● PRESSED</text>}
                  </g>
                );
              })()}

              {/* 6. Potentiometer — Realistic rotary dial */}
              {comp.type === 'potentiometer' && (() => {
                const angle = ((comp.value || 0) / 100) * 270 - 135;
                return (
                  <g>
                    {/* Square body */}
                    <rect x="0" y="0" width="50" height="50" rx="4" fill="#1c1c1e" stroke="#3a3a3c" strokeWidth="1.5" />

                    {/* PCB mounting pads / corners */}
                    <circle cx="4" cy="4" r="3" fill="#2a2a2c" stroke="#555" strokeWidth="0.5" />
                    <circle cx="46" cy="4" r="3" fill="#2a2a2c" stroke="#555" strokeWidth="0.5" />
                    <circle cx="4" cy="46" r="3" fill="#2a2a2c" stroke="#555" strokeWidth="0.5" />
                    <circle cx="46" cy="46" r="3" fill="#2a2a2c" stroke="#555" strokeWidth="0.5" />

                    {/* Outer dial ring */}
                    <circle cx="25" cy="25" r="20" fill="#2d2d2f" stroke="#555" strokeWidth="2" />

                    {/* Arc track */}
                    <path d="M 9 40 A 18 18 0 1 1 41 40" fill="none" stroke="#374151" strokeWidth="3" strokeLinecap="round" />
                    <path d="M 9 40 A 18 18 0 1 1 41 40" fill="none" stroke="#00f0ff" strokeWidth="2"
                      strokeLinecap="round" opacity="0.5"
                      strokeDasharray={`${(comp.value || 0) / 100 * 113} 113`} />

                    {/* Tick marks around the dial */}
                    {[0, 25, 50, 75, 100].map(v => {
                      const a = (v / 100 * 270 - 135) * (Math.PI / 180);
                      return (
                        <line key={v}
                          x1={25 + 17 * Math.cos(a)}
                          y1={25 + 17 * Math.sin(a)}
                          x2={25 + 20 * Math.cos(a)}
                          y2={25 + 20 * Math.sin(a)}
                          stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
                      );
                    })}

                    {/* Knob cap */}
                    <circle cx="25" cy="25" r="13" fill="#333" stroke="#555" strokeWidth="1" />
                    <circle cx="25" cy="25" r="10" fill="#404040" />

                    {/* Pointer line */}
                    <g transform={`rotate(${angle}, 25, 25)`}>
                      <line x1="25" y1="25" x2="25" y2="14"
                        stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="25" cy="14" r="2" fill="#00f0ff" />
                    </g>

                    {/* Knurled grip lines */}
                    {[-30, -15, 0, 15, 30].map(a => {
                      const rad = (a + angle + 90) * (Math.PI / 180);
                      return (
                        <line key={a}
                          x1={25 + 8 * Math.cos(rad)} y1={25 + 8 * Math.sin(rad)}
                          x2={25 + 11 * Math.cos(rad)} y2={25 + 11 * Math.sin(rad)}
                          stroke="#666" strokeWidth="1" opacity="0.5" />
                      );
                    })}

                    {/* Component legs */}
                    <rect x="10" y="50" width="30" height="10" fill="#333" rx="2" />
                    <line x1="14" y1="57" x2="14" y2="66" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="25" y1="57" x2="25" y2="66" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="36" y1="57" x2="36" y2="66" stroke="#b0b8c0" strokeWidth="2" />

                    <text x="25" y="-7" fill="#94a3b8" fontSize="9" fontWeight="500" textAnchor="middle">Pot ({comp.value || 0}%)</text>
                  </g>
                );
              })()}

              {/* 7. DHT11 Sensor — Realistic sensor module */}
              {comp.type === 'dht11' && (() => {
                const temp = comp.state?.temperature ?? 24;
                const hum = comp.state?.humidity ?? 45;
                return (
                  <g>
                    {/* Outer housing — realistic light blue */}
                    <rect width={comp.width} height="52" rx="5" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5" />

                    {/* Sensor face mesh — grid of rounded slots */}
                    {Array.from({ length: 3 }).map((_, r) =>
                      Array.from({ length: 5 }).map((_, c) => (
                        <rect
                          key={`${r}-${c}`}
                          x={5 + c * 9}
                          y={6 + r * 13}
                          width={6}
                          height={9}
                          fill="#1e40af"
                          rx="2"
                        />
                      ))
                    )}

                    {/* Top humidity label zone */}
                    <rect x="0" y="44" width={comp.width} height="10" rx="0" fill="#1d4ed8" />
                    <text x={comp.width / 2} y="51" fill="#bfdbfe" fontSize="6" fontFamily="monospace" textAnchor="middle">DHT11</text>

                    {/* White PCB connector block */}
                    <rect x="6" y="52" width={comp.width - 12} height="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" rx="1" />

                    {/* Pin labels */}
                    <text x="14" y="61" fill="#374151" fontSize="5.5" textAnchor="middle" fontFamily="monospace">+</text>
                    <text x="28" y="61" fill="#374151" fontSize="5.5" textAnchor="middle" fontFamily="monospace">D</text>
                    <text x="42" y="61" fill="#374151" fontSize="5.5" textAnchor="middle" fontFamily="monospace">-</text>

                    {/* Metal pins */}
                    <line x1="14" y1="64" x2="14" y2="74" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="28" y1="64" x2="28" y2="74" stroke="#b0b8c0" strokeWidth="2" />
                    <line x1="42" y1="64" x2="42" y2="74" stroke="#b0b8c0" strokeWidth="2" />

                    {/* Readout label */}
                    <text x={comp.width / 2} y="-7" fill="#93c5fd" fontSize="9" fontWeight="600" textAnchor="middle">
                      DHT11 {temp}°C {hum}%
                    </text>
                  </g>
                );
              })()}

              {/* 8. Breadboard — Realistic with colored power rails */}
              {comp.type === 'breadboard' && (
                <g>
                  {/* Base — off-white PCB look */}
                  <rect width={comp.width} height={comp.height} rx="6" fill="#e8ecf0" stroke="#c4cdd6" strokeWidth="2" />
                  <rect x="2" y="2" width={comp.width - 4} height={comp.height - 4} rx="5" fill="#f0f4f7" />

                  {/* Red power rail stripe top */}
                  <rect x="10" y="6" width={comp.width - 20} height="21" rx="2" fill="#fff1f0" stroke="#fca5a5" strokeWidth="0.8" />
                  <line x1="14" y1="13" x2={comp.width - 14} y2="13" stroke="#dc2626" strokeWidth="1.8" opacity="0.7" />
                  <line x1="14" y1="22" x2={comp.width - 14} y2="22" stroke="#1d4ed8" strokeWidth="1.8" opacity="0.7" />
                  <text x="8" y="14" fill="#dc2626" fontSize="7" fontWeight="bold" fontFamily="monospace">+</text>
                  <text x="8" y="23" fill="#1d4ed8" fontSize="7" fontWeight="bold" fontFamily="monospace">-</text>

                  {/* Central gutter */}
                  <rect x="10" y="65" width={comp.width - 20} height="10" fill="#d1d9e0" rx="2" />
                  <text x={comp.width / 2} y="73" fill="#94a3b8" fontSize="6" textAnchor="middle" fontFamily="monospace">A B C D E · F G H I J</text>

                  {/* Blue power rail stripe bottom */}
                  <rect x="10" y="113" width={comp.width - 20} height="21" rx="2" fill="#eff6ff" stroke="#93c5fd" strokeWidth="0.8" />
                  <line x1="14" y1="120" x2={comp.width - 14} y2="120" stroke="#dc2626" strokeWidth="1.8" opacity="0.7" />
                  <line x1="14" y1="129" x2={comp.width - 14} y2="129" stroke="#1d4ed8" strokeWidth="1.8" opacity="0.7" />
                  <text x="8" y="121" fill="#dc2626" fontSize="7" fontWeight="bold" fontFamily="monospace">+</text>
                  <text x="8" y="130" fill="#1d4ed8" fontSize="7" fontWeight="bold" fontFamily="monospace">-</text>

                  {/* Hole grid — upper section */}
                  {Array.from({ length: 30 }).map((_, col) => {
                    const cx = 25 + col * 15;
                    return (
                      <g key={col}>
                        {[36, 45, 54].map(cy => (
                          <circle key={cy} cx={cx} cy={cy} r="2.2"
                            fill="#cdd5de" stroke="#b0bec9" strokeWidth="0.8" />
                        ))}
                        {[78, 87, 96].map(cy => (
                          <circle key={cy} cx={cx} cy={cy} r="2.2"
                            fill="#cdd5de" stroke="#b0bec9" strokeWidth="0.8" />
                        ))}
                      </g>
                    );
                  })}

                  {/* Row number guides every 5 columns */}
                  {[1, 5, 10, 15, 20, 25, 30].map(n => (
                    <text key={n} x={25 + (n - 1) * 15} y="108" fill="#94a3b8" fontSize="5.5"
                      fontFamily="monospace" textAnchor="middle">{n}</text>
                  ))}

                  <text x={comp.width / 2} y="143" fill="#94a3b8" fontSize="7.5" fontFamily="monospace" textAnchor="middle" fontWeight="500">HALF-SIZE BREADBOARD · 400 POINTS</text>
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
