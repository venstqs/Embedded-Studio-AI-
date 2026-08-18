import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { Component, Wire, SimulationState, Pin } from '../types/circuit';
import { getResistorColorBands } from '../services/circuitPresets';
import { Trash2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props {
  components: Component[];
  wires: Wire[];
  setComponents: (c: Component[]) => void;
  setWires: (w: Wire[]) => void;
  simulationState: SimulationState;
  selectedWireColor: string;
  onSelectComponent?: (c: Component | null) => void;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface WireInProgress {
  fromPinId: string;
  fromX: number;
  fromY: number;
}

const CircuitCanvas: React.FC<Props> = ({
  components,
  wires,
  setComponents,
  setWires,
  simulationState,
  selectedWireColor,
  onSelectComponent,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [wireInProgress, setWireInProgress] = useState<WireInProgress | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, compId: string } | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Convert screen coords to SVG world coords
  const toWorld = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - view.x) / view.scale,
      y: (screenY - rect.top - view.y) / view.scale,
    };
  }, [view]);

  const getPinWorldPos = useCallback((pin: Pin, comp: Component) => ({
    x: comp.x + pin.x,
    y: comp.y + pin.y,
  }), []);


  // Keyboard: Delete selected component
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCompId) {
        setComponents(components.filter(c => c.id !== selectedCompId));
        setWires(wires.filter(w => {
          const comp = components.find(c => c.id === selectedCompId);
          return !comp?.pins.some(p => p.id === w.fromPinId || p.id === w.toPinId);
        }));
        setSelectedCompId(null);
        onSelectComponent?.(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCompId, components, wires, setComponents, setWires, onSelectComponent]);

  // --- Mouse Handlers ---
  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click = pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - view.x, y: e.clientY - view.y });
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      // Click on empty canvas = deselect & cancel wire
      const target = e.target as Element;
      if (target === svgRef.current || target.classList.contains('canvas-bg-rect')) {
        setSelectedCompId(null);
        setWireInProgress(null);
        onSelectComponent?.(null);
      }
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    const world = toWorld(e.clientX, e.clientY);
    setMousePos(world);

    if (isPanning) {
      setView(v => {
        // Limit panning to +/- 2000 pixels
        const newX = Math.max(-2000, Math.min(2000, e.clientX - panStart.x));
        const newY = Math.max(-2000, Math.min(2000, e.clientY - panStart.y));
        return { ...v, x: newX, y: newY };
      });
      return;
    }
    if (draggingCompId) {
      setComponents(components.map(c =>
        c.id === draggingCompId
          ? { ...c, x: Math.round((world.x - dragOffset.x) / 8) * 8, y: Math.round((world.y - dragOffset.y) / 8) * 8 }
          : c
      ));
    }
  };

  const handleSvgMouseUp = () => {
    setIsPanning(false);
    setDraggingCompId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleBy = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, view.scale * scaleBy));
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setView({
      scale: newScale,
      x: mouseX - (mouseX - view.x) * (newScale / view.scale),
      y: mouseY - (mouseY - view.y) * (newScale / view.scale),
    });
  };

  const handleCompMouseDown = (e: React.MouseEvent, comp: Component) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // If wire in progress, don't drag
    if (wireInProgress) return;
    setSelectedCompId(comp.id);
    onSelectComponent?.(comp);
    const world = toWorld(e.clientX, e.clientY);
    setDraggingCompId(comp.id);
    setDragOffset({ x: world.x - comp.x, y: world.y - comp.y });
  };

  const handlePinClick = (e: React.MouseEvent, pin: Pin, comp: Component) => {
    e.stopPropagation();
    const pinPos = getPinWorldPos(pin, comp);

    if (!wireInProgress) {
      setWireInProgress({ fromPinId: pin.id, fromX: pinPos.x, fromY: pinPos.y });
    } else {
      if (wireInProgress.fromPinId !== pin.id) {
        // Check if wire already exists
        const exists = wires.some(
          w => (w.fromPinId === wireInProgress.fromPinId && w.toPinId === pin.id) ||
               (w.fromPinId === pin.id && w.toPinId === wireInProgress.fromPinId)
        );
        if (!exists) {
          const newWire: Wire = {
            id: `wire_${generateId()}`,
            fromPinId: wireInProgress.fromPinId,
            toPinId: pin.id,
            color: selectedWireColor,
          };
          setWires([...wires, newWire]);
        }
      }
      setWireInProgress(null);
    }
  };

  // Wire routing: right-angle path
  const routeWire = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  };

  const getPinColor = (pin: Pin) => {
    switch (pin.type) {
      case 'power': return '#ef4444';
      case 'ground': return '#3b82f6';
      case 'digital': return '#f59e0b';
      case 'analog': return '#22c55e';
      case 'sensor': return '#8b5cf6';
      default: return '#71717a';
    }
  };



  // ---- Component Renderers ----
  const renderComponent = (comp: Component) => {
    const isSelected = comp.id === selectedCompId;
    const selectionClass = isSelected ? 'opacity-100' : 'opacity-0';

    const renderPins = () => comp.pins.map(pin => {
      const isHovered = hoveredPinId === pin.id;
      const isFromPin = wireInProgress?.fromPinId === pin.id;
      const pinColor = getPinColor(pin);
      const r = isHovered || isFromPin ? 7 : 5;
      return (
        <g key={pin.id}>
          <circle
            cx={pin.x} cy={pin.y} r={10}
            fill="transparent"
            className="cursor-crosshair"
            onClick={e => handlePinClick(e, pin, comp)}
            onMouseEnter={() => setHoveredPinId(pin.id)}
            onMouseLeave={() => setHoveredPinId(null)}
          />
          <circle
            cx={pin.x} cy={pin.y} r={r}
            fill={isFromPin ? '#06b6d4' : pinColor}
            stroke={isFromPin ? '#06b6d4' : 'rgba(255,255,255,0.3)'}
            strokeWidth={isFromPin ? 2 : 1}
            className="pointer-events-none"
          />
          {isHovered && (
            <text x={pin.x} y={pin.y - 10} textAnchor="middle" fontSize="9" fill="white"
              style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {pin.name}
            </text>
          )}
        </g>
      );
    });

    const selBorder = (
      <rect
        x={-4} y={-4} width={comp.width + 8} height={comp.height + 8}
        rx={6} ry={6}
        fill="none"
        stroke="#06b6d4"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        className={`${selectionClass} transition-opacity`}
      />
    );

    switch (comp.type) {
      case 'mcu':
        return renderMCU(comp, isSelected, selBorder, renderPins);
      case 'led':
        return renderLED(comp, isSelected, selBorder, renderPins);
      case 'rgb_led':
        return renderRGBLED(comp, isSelected, selBorder, renderPins);
      case 'resistor':
        return renderResistor(comp, isSelected, selBorder, renderPins);
      case 'button':
        return renderButton(comp, isSelected, selBorder, renderPins);
      case 'potentiometer':
        return renderPotentiometer(comp, isSelected, selBorder, renderPins);
      case 'dht11':
        return renderDHT11(comp, isSelected, selBorder, renderPins);
      case 'ultrasonic':
        return renderUltrasonic(comp, isSelected, selBorder, renderPins);
      case 'ldr':
        return renderLDR(comp, isSelected, selBorder, renderPins);
      case 'relay':
        return renderRelay(comp, isSelected, selBorder, renderPins);
      case 'servo':
        return renderServo(comp, isSelected, selBorder, renderPins);
      case 'buzzer':
        return renderBuzzer(comp, isSelected, selBorder, renderPins);
      case 'lcd':
        return renderLCD(comp, isSelected, selBorder, renderPins);
      case 'breadboard':
        return renderBreadboard(comp, isSelected, selBorder, renderPins);
      default:
        return null;
    }
  };

  // ---- COMPONENT SVG RENDERERS ----

  const renderMCU = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const isUno = comp.model === 'uno';
    const w = comp.width; const h = comp.height;
    const isOn = simulationState.isPlaying;

    if (isUno) {
      return (
        <>
          {selBorder}
          {/* Arduino Uno R3 PCB Base */}
          <rect x={0} y={0} width={w} height={h} rx={8} fill="#007e8a" stroke="#005d66" strokeWidth={1.5} />
          
          {/* Silkscreen outline & copper traces */}
          <rect x={4} y={4} width={w - 8} height={h - 8} rx={6} fill="none" stroke="#009ea8" strokeWidth={1} opacity={0.6} />
          <path d="M 20 40 Q 50 20 90 40 T 160 40" stroke="#00666e" strokeWidth={1.5} fill="none" />
          <path d="M 120 120 Q 150 140 210 120" stroke="#00666e" strokeWidth={1.5} fill="none" />

          {/* USB Type-B Port */}
          <rect x={-8} y={h / 2 - 18} width={24} height={32} rx={3} fill="#b0b5b9" stroke="#71777d" strokeWidth={1} />
          <rect x={-8} y={h / 2 - 12} width={6} height={20} fill="#495057" />

          {/* DC Power Barrel Jack */}
          <rect x={-4} y={h - 48} width={34} height={40} rx={4} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
          <circle cx={12} cy={h - 28} r={6} fill="#09090b" stroke="#71717a" strokeWidth={1} />
          <circle cx={12} cy={h - 28} r={2.5} fill="#d4d4d8" />

          {/* ATmega328P DIP IC Chip */}
          <rect x={90} y={62} width={96} height={36} rx={2} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
          <circle cx={96} cy={80} r={3} fill="#27272a" />
          <text x={138} y={83} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#e4e4e7" style={{ userSelect: 'none', fontFamily: 'JetBrains Mono, monospace' }}>
            ATMEGA328P-PU
          </text>
          {/* IC DIP Pins (Top and Bottom legs) */}
          {Array.from({ length: 14 }).map((_, i) => (
            <g key={i}>
              <rect x={94 + i * 6.4} y={57} width={3} height={5} fill="#a1a1aa" />
              <rect x={94 + i * 6.4} y={98} width={3} height={5} fill="#a1a1aa" />
            </g>
          ))}

          {/* Reset Tactile Button */}
          <rect x={16} y={12} width={14} height={14} rx={2} fill="#27272a" stroke="#52525b" strokeWidth={1} />
          <circle cx={23} cy={19} r={4} fill="#ef4444" />
          <text x={23} y={32} textAnchor="middle" fontSize="6" fill="#a1a1aa" fontWeight="bold" style={{ userSelect: 'none' }}>RESET</text>

          {/* 16MHz Crystal Oscillator */}
          <rect x={55} y={70} width={20} height={10} rx={4} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={0.5} />
          <text x={65} y={77} textAnchor="middle" fontSize="5" fontWeight="bold" fill="#3f3f46" style={{ userSelect: 'none' }}>16.000</text>

          {/* Header Pin Sockets (Top & Bottom) */}
          <rect x={28} y={6} width={198} height={14} fill="#18181b" stroke="#3f3f46" strokeWidth={0.5} />
          <rect x={28} y={h - 20} width={185} height={14} fill="#18181b" stroke="#3f3f46" strokeWidth={0.5} />

          {/* Header Pin Sockets Details */}
          {Array.from({ length: 18 }).map((_, i) => (
            <rect key={i} x={31 + i * 11} y={9} width={6} height={8} fill="#09090b" rx={1} />
          ))}

          {/* Board Silkscreen Brand Label */}
          <text x={w / 2 + 10} y={42} textAnchor="middle" fontSize="13" fontWeight="900" fill="#ffffff" style={{ userSelect: 'none', fontFamily: 'Inter, sans-serif', letterSpacing: '1px' }}>
            ARDUINO
          </text>
          <text x={w / 2 + 10} y={54} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#67e8f9" style={{ userSelect: 'none', fontFamily: 'JetBrains Mono, monospace' }}>
            UNO R3
          </text>

          {/* Status LEDs (PWR, L, TX, RX) */}
          {/* PWR LED */}
          <circle cx={w - 24} cy={42} r={3.5} fill={isOn ? '#22c55e' : '#14532d'} stroke="#16a34a" strokeWidth={0.5} />
          <text x={w - 24} y={52} textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#a1a1aa" style={{ userSelect: 'none' }}>ON</text>
          {/* L (Pin 13) LED */}
          <circle cx={w - 38} cy={42} r={3.5} fill={isOn ? '#f59e0b' : '#78350f'} stroke="#d97706" strokeWidth={0.5} />
          <text x={w - 38} y={52} textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#a1a1aa" style={{ userSelect: 'none' }}>L</text>
          {/* TX & RX LEDs */}
          <circle cx={w - 52} cy={42} r={3} fill={isOn ? '#3b82f6' : '#1e3a8a'} />
          <circle cx={w - 64} cy={42} r={3} fill={isOn ? '#3b82f6' : '#1e3a8a'} />
          <text x={w - 58} y={52} textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#a1a1aa" style={{ userSelect: 'none' }}>TX/RX</text>

          {renderPins()}
        </>
      );
    } else {
      // ESP32 DevKit v1 Renderer
      return (
        <>
          {selBorder}
          {/* ESP32 Matte Black PCB Base */}
          <rect x={0} y={0} width={w} height={h} rx={8} fill="#121215" stroke="#27272a" strokeWidth={1.5} />
          <rect x={4} y={4} width={w - 8} height={h - 8} rx={6} fill="none" stroke="#3f3f46" strokeWidth={0.5} opacity={0.6} />

          {/* Metallic RF Shield Cap (ESP-WROOM-32) */}
          <rect x={22} y={30} width={w - 44} height={94} rx={4} fill="#27272a" stroke="#52525b" strokeWidth={1} />
          {/* PCB Antenna Pattern on Shield */}
          <path d={`M 30 36 h ${w - 60} v 12 h -10 v -6 h -10 v 6 h -10 v -6 h -10`} stroke="#e4e4e7" strokeWidth={1.5} fill="none" />
          <text x={w / 2} y={72} textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff" style={{ userSelect: 'none', fontFamily: 'Inter, sans-serif' }}>
            ESP32
          </text>
          <text x={w / 2} y={84} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#a1a1aa" style={{ userSelect: 'none', fontFamily: 'JetBrains Mono, monospace' }}>
            ESP-WROOM-32
          </text>
          <text x={w / 2} y={96} textAnchor="middle" fontSize="5.5" fill="#71717a" style={{ userSelect: 'none' }}>
            Wi-Fi + BT / BLE
          </text>

          {/* Micro-USB Port */}
          <rect x={w / 2 - 14} y={h - 16} width={28} height={18} rx={3} fill="#a1a1aa" stroke="#71717a" strokeWidth={1} />
          <rect x={w / 2 - 8} y={h - 8} width={16} height={8} fill="#27272a" />

          {/* Tactile Buttons: EN & BOOT */}
          <rect x={16} y={h - 38} width={16} height={14} rx={2} fill="#27272a" stroke="#52525b" strokeWidth={1} />
          <circle cx={24} cy={h - 31} r={4} fill="#52525b" />
          <text x={24} y={h - 42} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#a1a1aa" style={{ userSelect: 'none' }}>EN</text>

          <rect x={w - 32} y={h - 38} width={16} height={14} rx={2} fill="#27272a" stroke="#52525b" strokeWidth={1} />
          <circle cx={w - 24} cy={h - 31} r={4} fill="#52525b" />
          <text x={w - 24} y={h - 42} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#a1a1aa" style={{ userSelect: 'none' }}>BOOT</text>

          {/* Dual Header Pins Sockets (Left & Right) */}
          <rect x={8} y={22} width={12} height={196} fill="#18181b" stroke="#3f3f46" strokeWidth={0.5} />
          <rect x={w - 20} y={22} width={12} height={196} fill="#18181b" stroke="#3f3f46" strokeWidth={0.5} />

          {/* Status LEDs */}
          <circle cx={35} cy={142} r={3} fill={isOn ? '#ef4444' : '#7f1d1d'} />
          <text x={35} y={152} textAnchor="middle" fontSize="5" fill="#a1a1aa" style={{ userSelect: 'none' }}>PWR</text>

          <circle cx={w - 35} cy={142} r={3} fill={isOn ? '#3b82f6' : '#1e3a8a'} />
          <text x={w - 35} y={152} textAnchor="middle" fontSize="5" fill="#a1a1aa" style={{ userSelect: 'none' }}>D2</text>

          {renderPins()}
        </>
      );
    }
  };

  const renderLED = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const isOn = simulationState.isPlaying && comp.state?.isOn;
    const ledColor = comp.color === 'red' ? '#ef4444' : comp.color === 'green' ? '#22c55e' :
                     comp.color === 'blue' ? '#3b82f6' : '#f59e0b';
    const dimColor = comp.color === 'red' ? '#7f1d1d' : comp.color === 'green' ? '#14532d' :
                     comp.color === 'blue' ? '#1e3a8a' : '#78350f';
    const activeColor = isOn ? ledColor : dimColor;

    return (
      <>
        {selBorder}
        {/* LED body */}
        <ellipse cx={comp.width / 2} cy={comp.height / 2 - 10} rx={15} ry={20}
          fill={activeColor}
          stroke={isOn ? ledColor : '#555'}
          strokeWidth={isOn ? 2 : 1}
        />
        {/* Flat bottom of LED dome */}
        <rect x={comp.width / 2 - 15} y={comp.height / 2 + 5} width={30} height={8} rx={2}
          fill={isOn ? ledColor : dimColor} />
        {/* Leads */}
        <line x1={comp.width / 2 - 8} y1={comp.height / 2 + 13} x2={comp.width / 2 - 8} y2={comp.height - 4}
          stroke="#999" strokeWidth={1.5} />
        <line x1={comp.width / 2 + 8} y1={comp.height / 2 + 13} x2={comp.width / 2 + 8} y2={comp.height - 4}
          stroke="#999" strokeWidth={1.5} />
        {/* +/- labels */}
        <text x={comp.width / 2 - 8} y={comp.height + 8} textAnchor="middle" fontSize="7" fill="#999">A</text>
        <text x={comp.width / 2 + 8} y={comp.height + 8} textAnchor="middle" fontSize="7" fill="#999">K</text>
        {isOn && (
          <ellipse cx={comp.width / 2} cy={comp.height / 2 - 10} rx={22} ry={28}
            fill={ledColor} opacity={0.15} />
        )}
        {renderPins()}
      </>
    );
  };

  const renderRGBLED = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const r = simulationState.isPlaying ? (comp.state?.rValue ?? 0) : 0;
    const g = simulationState.isPlaying ? (comp.state?.gValue ?? 0) : 0;
    const b = simulationState.isPlaying ? (comp.state?.bValue ?? 0) : 0;
    const isOn = r > 0 || g > 0 || b > 0;
    const color = `rgb(${r},${g},${b})`;
    return (
      <>
        {selBorder}
        <ellipse cx={comp.width / 2} cy={comp.height / 2 - 6} rx={18} ry={22}
          fill={isOn ? color : '#1f2937'}
          stroke={isOn ? color : '#555'} strokeWidth={1}
        />
        <rect x={comp.width / 2 - 18} y={comp.height / 2 + 12} width={36} height={8} rx={2}
          fill={isOn ? color : '#374151'} />
        {/* Leads */}
        {[-16, -5, 6, 17].map((offset, i) => (
          <line key={i} x1={comp.width / 2 + offset} y1={comp.height / 2 + 20}
            x2={comp.width / 2 + offset} y2={comp.height - 2}
            stroke="#999" strokeWidth={1.5} />
        ))}
        <text x={comp.width / 2} y={-4} textAnchor="middle" fontSize="8" fill="#9ca3af" style={{ userSelect: 'none' }}>RGB</text>
        {renderPins()}
      </>
    );
  };

  const renderResistor = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const bands = getResistorColorBands(comp.value ?? 220);
    return (
      <>
        {selBorder}
        {/* Body */}
        <rect x={16} y={5} width={comp.width - 32} height={18} rx={4} fill="#c8a870" stroke="#a87842" strokeWidth={1} />
        {/* Color bands */}
        {bands.map((color, i) => (
          <rect key={i} x={22 + i * 11} y={5} width={7} height={18} fill={color} />
        ))}
        {/* Leads */}
        <line x1={0} y1={14} x2={16} y2={14} stroke="#aaa" strokeWidth={2} />
        <line x1={comp.width - 16} y1={14} x2={comp.width} y2={14} stroke="#aaa" strokeWidth={2} />
        <text x={comp.width / 2} y={-4} textAnchor="middle" fontSize="8" fill="#9ca3af" style={{ userSelect: 'none' }}>
          {comp.value}Ω
        </text>
        {renderPins()}
      </>
    );
  };

  const renderButton = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const isPressed = simulationState.isPlaying && comp.state?.isPressed;
    return (
      <>
        {selBorder}
        <rect x={6} y={6} width={36} height={36} rx={4} fill="#374151" stroke="#4b5563" strokeWidth={1} />
        {/* Button cap */}
        <circle cx={comp.width / 2} cy={comp.height / 2 - 4} r={12}
          fill={isPressed ? '#3b82f6' : '#6b7280'}
          stroke={isPressed ? '#60a5fa' : '#9ca3af'} strokeWidth={1} />
        {renderPins()}
      </>
    );
  };

  const renderPotentiometer = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const pct = (comp.value ?? 50) / 100;
    const angle = pct * 270 - 135;
    const rad = (angle * Math.PI) / 180;
    const cx = comp.width / 2; const cy = comp.height / 2 - 6;
    const r = 20;
    const kx = cx + r * Math.cos(rad); const ky = cy + r * Math.sin(rad);
    return (
      <>
        {selBorder}
        <rect x={4} y={4} width={comp.width - 8} height={comp.height - 20} rx={4} fill="#1f2937" stroke="#374151" />
        <circle cx={cx} cy={cy} r={22} fill="#374151" stroke="#4b5563" />
        <circle cx={cx} cy={cy} r={14} fill="#6b7280" stroke="#9ca3af" strokeWidth={0.5} />
        <line x1={cx} y1={cy} x2={kx} y2={ky} stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" />
        <text x={cx} y={comp.height - 6} textAnchor="middle" fontSize="8" fill="#9ca3af" style={{ userSelect: 'none' }}>10kΩ</text>
        {renderPins()}
      </>
    );
  };

  const renderDHT11 = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const temp = comp.state?.temperature ?? 25;
    const hum = comp.state?.humidity ?? 50;
    const isActive = simulationState.isPlaying;
    return (
      <>
        {selBorder}
        <rect x={4} y={4} width={comp.width - 8} height={comp.height - 20} rx={6} fill="#0c4a6e" stroke="#0ea5e9" strokeWidth={1} />
        <rect x={8} y={8} width={comp.width - 16} height={comp.height - 32} rx={4} fill="#082f49" />
        <text x={comp.width / 2} y={20} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#38bdf8" style={{ userSelect: 'none' }}>DHT11</text>
        {isActive && (
          <>
            <text x={comp.width / 2} y={34} textAnchor="middle" fontSize="7" fill="#7dd3fc" style={{ userSelect: 'none' }}>{temp}°C</text>
            <text x={comp.width / 2} y={44} textAnchor="middle" fontSize="7" fill="#7dd3fc" style={{ userSelect: 'none' }}>{hum}%RH</text>
          </>
        )}
        {!isActive && (
          <text x={comp.width / 2} y={38} textAnchor="middle" fontSize="8" fill="#0ea5e9" style={{ userSelect: 'none' }}>T&H</text>
        )}
        {renderPins()}
      </>
    );
  };

  const renderUltrasonic = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const dist = comp.state?.distance ?? 20;
    const isActive = simulationState.isPlaying;
    return (
      <>
        {selBorder}
        <rect x={2} y={2} width={comp.width - 4} height={comp.height - 10} rx={4} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} />
        {/* Transducer circles */}
        <circle cx={22} cy={(comp.height - 10) / 2} r={12} fill="#1e40af" stroke="#60a5fa" strokeWidth={1} />
        <circle cx={22} cy={(comp.height - 10) / 2} r={7} fill="#3b82f6" />
        <circle cx={68} cy={(comp.height - 10) / 2} r={12} fill="#1e40af" stroke="#60a5fa" strokeWidth={1} />
        <circle cx={68} cy={(comp.height - 10) / 2} r={7} fill="#3b82f6" />
        <text x={comp.width / 2} y={14} textAnchor="middle" fontSize="8" fill="#93c5fd" style={{ userSelect: 'none' }}>HC-SR04</text>
        {isActive && (
          <text x={comp.width / 2} y={comp.height - 14} textAnchor="middle" fontSize="9" fill="#60a5fa" style={{ userSelect: 'none' }}>{dist}cm</text>
        )}
        {renderPins()}
      </>
    );
  };

  const renderLDR = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    return (
      <>
        {selBorder}
        <ellipse cx={comp.width / 2} cy={comp.height / 2 - 6} rx={18} ry={20} fill="#eab308" stroke="#ca8a04" strokeWidth={1} />
        <ellipse cx={comp.width / 2} cy={comp.height / 2 - 6} rx={10} ry={12} fill="#fef08a" opacity={0.5} />
        {/* Squiggle lines for photoresistor */}
        <path d={`M ${comp.width/2 - 6} ${comp.height/2 - 12} q 3 3 0 6 q -3 3 0 6`}
          stroke="#92400e" strokeWidth={1.5} fill="none" />
        <text x={comp.width / 2} y={comp.height - 2} textAnchor="middle" fontSize="7" fill="#9ca3af" style={{ userSelect: 'none' }}>LDR</text>
        {renderPins()}
      </>
    );
  };

  const renderRelay = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const isClosed = simulationState.isPlaying && comp.state?.isRelayClosed;
    return (
      <>
        {selBorder}
        <rect x={2} y={2} width={comp.width - 4} height={comp.height - 12} rx={4} fill="#1f2937" stroke="#374151" />
        {/* Coil symbol */}
        <rect x={8} y={8} width={20} height={24} rx={3} fill="#451a03" stroke="#f97316" strokeWidth={1} />
        <text x={18} y={24} textAnchor="middle" fontSize="7" fill="#fed7aa" style={{ userSelect: 'none' }}>COIL</text>
        {/* Switch */}
        <line x1={36} y1={10} x2={62} y2={10} stroke="#374151" strokeWidth={1.5} />
        <line x1={36} y1={30} x2={62} y2={30} stroke="#374151" strokeWidth={1.5} />
        <line x1={36} y1={10} x2={36} y2={isClosed ? 30 : 22} stroke={isClosed ? '#22c55e' : '#9ca3af'} strokeWidth={2} />
        {renderPins()}
      </>
    );
  };

  const renderServo = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const angle = simulationState.isPlaying ? (comp.state?.angle ?? 90) : 90;
    const rad = ((angle - 90) * Math.PI) / 180;
    const cx = comp.width / 2; const cy = comp.height / 2 - 10;
    return (
      <>
        {selBorder}
        <rect x={4} y={4} width={comp.width - 8} height={comp.height - 18} rx={6} fill="#374151" stroke="#4b5563" />
        {/* Shaft */}
        <circle cx={cx} cy={cy} r={16} fill="#1f2937" stroke="#6b7280" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={5} fill="#4b5563" />
        {/* Arm */}
        <line x1={cx} y1={cy}
          x2={cx + Math.cos(rad) * 20} y2={cy + Math.sin(rad) * 20}
          stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" />
        <text x={cx} y={comp.height - 6} textAnchor="middle" fontSize="7" fill="#9ca3af" style={{ userSelect: 'none' }}>SG90 {angle}°</text>
        {renderPins()}
      </>
    );
  };

  const renderBuzzer = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const isActive = simulationState.isPlaying && (comp.state?.frequency ?? 0) > 0;
    const freq = comp.state?.frequency ?? 0;
    return (
      <>
        {selBorder}
        <circle cx={comp.width / 2} cy={comp.height / 2 - 4} r={20}
          fill={isActive ? '#451a03' : '#1f2937'}
          stroke={isActive ? '#f97316' : '#374151'} strokeWidth={2} />
        <circle cx={comp.width / 2} cy={comp.height / 2 - 4} r={8} fill={isActive ? '#ea580c' : '#374151'} />
        {isActive && (
          <text x={comp.width / 2} y={comp.height + 6} textAnchor="middle" fontSize="8" fill="#f97316" style={{ userSelect: 'none' }}>{freq}Hz</text>
        )}
        {!isActive && (
          <text x={comp.width / 2} y={comp.height - 2} textAnchor="middle" fontSize="7" fill="#6b7280" style={{ userSelect: 'none' }}>BUZZER</text>
        )}
        {renderPins()}
      </>
    );
  };

  const renderLCD = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    const text = simulationState.isPlaying ? (comp.state?.text || 'XavierLabs IDE') : '';
    const lines = text.split('\n');
    return (
      <>
        {selBorder}
        <rect x={2} y={2} width={comp.width - 4} height={comp.height - 12} rx={4} fill="#166534" stroke="#15803d" />
        {/* Screen area */}
        <rect x={8} y={6} width={comp.width - 16} height={comp.height - 26} rx={2} fill="#052e16" />
        {lines.map((line, i) => (
          <text key={i} x={12} y={20 + i * 16}
            fontSize="9" fill="#4ade80"
            fontFamily="JetBrains Mono, monospace"
            style={{ userSelect: 'none' }}>
            {line.substring(0, 20)}
          </text>
        ))}
        {!simulationState.isPlaying && (
          <text x={comp.width / 2} y={30} textAnchor="middle" fontSize="8" fill="#166534" style={{ userSelect: 'none' }}>LCD 1602</text>
        )}
        {renderPins()}
      </>
    );
  };

  const renderBreadboard = (comp: Component, _: boolean, selBorder: React.ReactNode, renderPins: () => React.ReactNode) => {
    return (
      <>
        {selBorder}
        <rect x={0} y={0} width={comp.width} height={comp.height} rx={4} fill="#e5e0d0" />
        {/* Power rails */}
        <rect x={0} y={0} width={comp.width} height={12} rx={2} fill="#fca5a5" opacity={0.4} />
        <rect x={0} y={comp.height - 12} width={comp.width} height={12} rx={2} fill="#93c5fd" opacity={0.4} />
        {/* Tie-point holes */}
        {Array.from({ length: 30 }).map((_, col) =>
          Array.from({ length: 10 }).map((__, row) => (
            row !== 4 && row !== 5 && (
              <circle key={`${col}-${row}`}
                cx={20 + col * 17}
                cy={20 + row * 11 + (row >= 5 ? 10 : 0)}
                r={3}
                fill="#7a7060"
              />
            )
          ))
        )}
        <text x={comp.width / 2} y={comp.height + 10} textAnchor="middle" fontSize="8" fill="#6b7280" style={{ userSelect: 'none' }}>Breadboard</text>
        {renderPins()}
      </>
    );
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ cursor: isPanning ? 'grabbing' : wireInProgress ? 'crosshair' : 'default' }}>
      {/* Canvas Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        <button onClick={() => setView(v => ({ ...v, scale: Math.min(3, v.scale * 1.2) }))}
          className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-active)] transition-all shadow-lg"
          title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button onClick={() => setView(v => ({ ...v, scale: Math.max(0.3, v.scale * 0.8) }))}
          className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-active)] transition-all shadow-lg"
          title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-active)] transition-all shadow-lg"
          title="Reset View">
          <Maximize2 size={16} />
        </button>
        {selectedCompId && (
          <button
            onClick={() => {
              setComponents(components.filter(c => c.id !== selectedCompId));
              setWires(wires.filter(w => {
                const comp = components.find(c => c.id === selectedCompId);
                return !comp?.pins.some(p => p.id === w.fromPinId || p.id === w.toPinId);
              }));
              setSelectedCompId(null);
              onSelectComponent?.(null);
            }}
            className="p-2 rounded-lg bg-red-900 border border-red-700 text-red-400 hover:bg-red-800 hover:text-red-300 transition-all shadow-lg"
            title="Delete Selected (Del)">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Scale indicator */}
      <div className="absolute bottom-4 right-4 z-10 font-mono text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-color)] px-2 py-1 rounded-md">
        {Math.round(view.scale * 100)}%
      </div>

      {/* Wire mode indicator */}
      {wireInProgress && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-[var(--bg-active)] border border-[var(--border-color)] text-[var(--color-cyan)] px-4 py-1.5 rounded-full text-xs font-semibold shadow-md">
          ⚡ Click a pin to complete wire — Press Esc to cancel
        </div>
      )}

      {/* Empty canvas hint */}
      {components.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="text-center">
            <div className="text-[var(--text-muted)] text-6xl mb-4 opacity-20">⚡</div>
            <p className="text-[var(--text-muted)] font-mono text-sm opacity-50">Add components from the library to start your circuit</p>
            <p className="text-[var(--text-muted)] font-mono text-xs opacity-30 mt-2">Click components to select · Drag to move · Click pins to wire</p>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleSvgMouseUp}
        onWheel={handleWheel}
        style={{ userSelect: 'none' }}
      >
        <defs>
          {/* Dotted grid pattern */}
          <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.08)" />
          </pattern>
          {/* Radial fade mask */}
          <radialGradient id="canvas-fade" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="canvas-mask">
            <rect width="100%" height="100%" fill="url(#canvas-fade)" />
          </mask>

        </defs>

        {/* Background grid */}
        <rect className="canvas-bg-rect" width="100%" height="100%" fill="#09090b" />
        <rect width="100%" height="100%" fill="url(#grid-dots)" mask="url(#canvas-mask)" />

        {/* World-space group */}
        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          {/* Rendered Wires */}
          {wires.map(wire => {
            const fromPin = components.flatMap(c => c.pins).find(p => p.id === wire.fromPinId);
            const toPin = components.flatMap(c => c.pins).find(p => p.id === wire.toPinId);
            const fromComp = components.find(c => c.pins.some(p => p.id === wire.fromPinId));
            const toComp = components.find(c => c.pins.some(p => p.id === wire.toPinId));
            if (!fromPin || !toPin || !fromComp || !toComp) return null;
            const x1 = fromComp.x + fromPin.x; const y1 = fromComp.y + fromPin.y;
            const x2 = toComp.x + toPin.x; const y2 = toComp.y + toPin.y;
            return (
              <path
                key={wire.id}
                d={routeWire(x1, y1, x2, y2)}
                stroke={wire.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                opacity={0.85}
              />
            );
          })}

          {/* Wire in progress */}
          {wireInProgress && (
            <>
              <path
                d={routeWire(wireInProgress.fromX, wireInProgress.fromY, mousePos.x, mousePos.y)}
                stroke={selectedWireColor}
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 4"
                strokeLinecap="round"
                opacity={0.7}
              />
              <circle cx={wireInProgress.fromX} cy={wireInProgress.fromY} r={6}
                fill="#06b6d4" opacity={0.6} />
            </>
          )}

          {/* Components */}
          {components.map(comp => (
            <g
              key={comp.id}
              transform={`translate(${comp.x},${comp.y})`}
              style={{ cursor: draggingCompId === comp.id ? 'grabbing' : wireInProgress ? 'crosshair' : 'grab' }}
              onMouseDown={e => handleCompMouseDown(e, comp)}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedCompId(comp.id);
                setContextMenu({ x: e.clientX, y: e.clientY, compId: comp.id });
              }}
            >
              {renderComponent(comp)}
            </g>
          ))}
        </g>
      </svg>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#1e1e1e] border border-[#333] rounded-md shadow-lg py-1 w-48 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button 
            className="w-full text-left px-4 py-2 hover:bg-[#2d2d2d] text-white flex items-center space-x-2"
            onClick={() => {
              const comp = components.find(c => c.id === contextMenu.compId);
              if (comp) {
                setComponents(components.map(c => c.id === comp.id ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c));
              }
              setContextMenu(null);
            }}
          >
            <span>Rotate 90°</span>
          </button>
          <div className="h-px w-full bg-[#333] my-1" />
          <button 
            className="w-full text-left px-4 py-2 hover:bg-red-900/40 text-red-400 flex items-center space-x-2"
            onClick={() => {
              setComponents(components.filter(c => c.id !== contextMenu.compId));
              setWires(wires.filter(w => {
                const comp = components.find(c => c.id === contextMenu.compId);
                return !comp?.pins.some(p => p.id === w.fromPinId || p.id === w.toPinId);
              }));
              setContextMenu(null);
              setSelectedCompId(null);
            }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Properties Panel Overlay */}
      {selectedCompId && !contextMenu && (() => {
        const comp = components.find(c => c.id === selectedCompId);
        if (!comp || comp.type === 'breadboard') return null;
        
        return (
          <div className="absolute top-4 right-4 z-40 bg-[#1e1e1e]/90 backdrop-blur-md border border-[#333] rounded-lg shadow-xl w-64 text-xs">
            <div className="px-3 py-2 border-b border-[#333] font-semibold text-white flex justify-between items-center">
              <span>{comp.name} Properties</span>
              <button onClick={() => setSelectedCompId(null)} className="text-[#888] hover:text-white">✕</button>
            </div>
            <div className="p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#888]">Position X</span>
                <span className="text-white font-mono">{comp.x}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#888]">Position Y</span>
                <span className="text-white font-mono">{comp.y}</span>
              </div>
              
              {comp.type === 'resistor' && (
                <div>
                  <label className="block text-[#888] mb-1">Resistance (Ω)</label>
                  <select 
                    className="w-full bg-[#09090b] border border-[#333] rounded px-2 py-1 text-white outline-none"
                    value={comp.value || 220}
                    onChange={e => {
                      setComponents(components.map(c => 
                        c.id === comp.id ? { ...c, value: parseInt(e.target.value) } : c
                      ));
                    }}
                  >
                    <option value={220}>220 Ω</option>
                    <option value={330}>330 Ω</option>
                    <option value={1000}>1 kΩ</option>
                    <option value={10000}>10 kΩ</option>
                  </select>
                </div>
              )}

              {comp.type === 'led' && (
                <div>
                  <label className="block text-[#888] mb-1">LED Color</label>
                  <select 
                    className="w-full bg-[#09090b] border border-[#333] rounded px-2 py-1 text-white outline-none"
                    value={comp.color || 'red'}
                    onChange={e => {
                      setComponents(components.map(c => 
                        c.id === comp.id ? { ...c, color: e.target.value } : c
                      ));
                    }}
                  >
                    <option value="red">Red</option>
                    <option value="green">Green</option>
                    <option value="blue">Blue</option>
                    <option value="yellow">Yellow</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default CircuitCanvas;
