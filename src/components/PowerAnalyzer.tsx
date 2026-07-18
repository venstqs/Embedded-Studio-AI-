import React from 'react';
import { Battery, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Component } from '../types/circuit';

interface PowerAnalyzerProps {
  components: Component[];
  mcuModel: 'uno' | 'esp32';
}

export const PowerAnalyzer: React.FC<PowerAnalyzerProps> = ({
  components,
  mcuModel,
}) => {
  const getBaseCurrent = () => {
    if (mcuModel === 'esp32') {
      return 80; // ESP32 DevKit baseline active (80mA)
    }
    return 45; // Arduino Uno R3 baseline (45mA)
  };

  const calculateTotalCurrent = () => {
    let current = getBaseCurrent();

    components.forEach((comp) => {
      if (comp.type === 'led' && comp.state?.isOn) {
        current += 15; // LED active draws ~15mA
      }
      if (comp.type === 'dht11') {
        current += 1.5; // DHT11 active draws ~1.5mA
      }
      if (comp.type === 'potentiometer') {
        current += 0.33; // 3.3V / 10k resistance draws ~0.33mA
      }
      if (comp.type === 'button' && comp.state?.isPressed) {
        current += 0.5; // press closing draws minimal load
      }
    });

    return parseFloat(current.toFixed(2));
  };

  const totalCurrent = calculateTotalCurrent();
  const limitCurrent = 500; // Standard USB current limit (500mA)
  const percentOfLimit = Math.min(100, (totalCurrent / limitCurrent) * 100);

  const batteries = [
    { name: 'CR2032 Coin Cell', capacity: 220, type: 'Coin' },
    { name: '2x AA Alkaline', capacity: 1500, type: 'AA' },
    { name: '18650 Li-ion', capacity: 2600, type: 'Li-ion' },
  ];

  const calculateRuntime = (capacity: number) => {
    const hours = capacity / totalCurrent;
    if (hours < 24) {
      return `${hours.toFixed(1)} hrs`;
    }
    return `${(hours / 24).toFixed(1)} days`;
  };

  const getEfficiencyGrade = () => {
    if (totalCurrent < 50) return { grade: 'A+', color: 'efficiency-aplus' };
    if (totalCurrent < 80) return { grade: 'A', color: 'efficiency-a' };
    if (totalCurrent < 120) return { grade: 'B', color: 'efficiency-b' };
    if (totalCurrent < 200) return { grade: 'C', color: 'efficiency-c' };
    return { grade: 'D', color: 'efficiency-d' };
  };

  const efficiency = getEfficiencyGrade();

  return (
    <div className="power-container">

      {/* Main current gauge */}
      <div className="power-gauge-card">
        <div className="power-gauge-draw">
          <span className="power-gauge-label">Estimated Current Draw</span>
          <div className="power-gauge-value font-mono">
            <span>{totalCurrent}</span>
            <span className="power-gauge-unit">mA</span>
          </div>
        </div>
        <div className="power-gauge-efficiency">
          <span className="power-gauge-label text-right block">Efficiency</span>
          <div className={`power-gauge-grade ${efficiency.color}`}>{efficiency.grade}</div>
        </div>
      </div>

      {/* USB safety limit bar */}
      <div className="progress-section">
        <div className="progress-bar-header">
          <span>USB Power Limit</span>
          <span className={percentOfLimit > 80 ? 'text-danger' : 'text-secondary'}>
            {totalCurrent} / {limitCurrent} mA ({percentOfLimit.toFixed(0)}%)
          </span>
        </div>
        <div className="progress-bar-container">
          <div
            className={`progress-bar-fill ${
              percentOfLimit > 80
                ? 'bg-danger'
                : percentOfLimit > 40
                ? 'bg-warning'
                : 'bg-success'
            }`}
            style={{ width: `${percentOfLimit}%` }}
          />
        </div>
        <div className="progress-bar-subtext">
          <span>0 mA</span>
          <span>USB Safety Limit (500mA)</span>
        </div>
      </div>

      {/* Battery Calculator */}
      <div className="battery-calculator-section">
        <h4 className="battery-section-title">
          <Battery size={14} className="icon-success" />
          <span>Battery Life Forecast</span>
        </h4>
        
        <div className="battery-cards-grid">
          {batteries.map((b) => (
            <div key={b.name} className="battery-card">
              <div className="battery-card-details">
                <span className="battery-name">{b.name}</span>
                <span className="battery-capacity">Capacity: {b.capacity} mAh</span>
              </div>
              <div className="battery-card-runtime">
                <span className="runtime-value font-mono">
                  {calculateRuntime(b.capacity)}
                </span>
                <span className="runtime-label">Est. Runtime</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety recommendations */}
      <div className="safety-notice-card">
        {totalCurrent < 150 ? (
          <ShieldCheck size={18} className="safety-notice-icon icon-success" />
        ) : (
          <AlertTriangle size={18} className="safety-notice-icon icon-warning" />
        )}
        <div className="safety-notice-details">
          <strong className="safety-notice-title">
            {totalCurrent < 150 ? 'Low Power Mode' : 'High Current Draw Detected'}
          </strong>
          <span className="safety-notice-text">
            {totalCurrent < 150
              ? 'Your circuit operates safely within baseline limits. Perfect for standard educational settings.'
              : 'Your current consumption is elevated. If utilizing multiple components or high-power sensors in real life, consider powering the microcontroller via an external power supply or using power-saving sleep configurations.'}
          </span>
        </div>
      </div>
    </div>
  );
};
