import React, { useState } from 'react';
import { Search, Eye } from 'lucide-react';

interface DatasheetItem {
  id: string;
  name: string;
  category: string;
  voltage: string;
  description: string;
  details: {
    pins: string;
    maxCurrent: string;
    freq?: string;
    parameters: Array<{ label: string; value: string }>;
    pinoutDescription: Record<string, string>;
  };
}

const DATASHEET_DB: DatasheetItem[] = [
  {
    id: 'uno',
    name: 'Arduino Uno R3 (ATmega328P)',
    category: 'Microcontroller',
    voltage: '5V (Operating)',
    description: 'A microcontroller board based on the ATmega328P. Features 14 digital input/output pins, 6 analog inputs, a 16 MHz ceramic resonator, a USB connection, and a power jack.',
    details: {
      pins: '14 Digital I/O, 6 Analog Inputs',
      maxCurrent: '20 mA per I/O pin',
      freq: '16 MHz',
      parameters: [
        { label: 'Input Voltage (limits)', value: '6 - 20 V' },
        { label: 'Flash Memory', value: '32 KB (ATmega328P) of which 0.5 KB used by bootloader' },
        { label: 'SRAM', value: '2 KB (ATmega328P)' },
        { label: 'EEPROM', value: '1 KB (ATmega328P)' },
      ],
      pinoutDescription: {
        'D0 / RX': 'Serial receive pin (0V / 5V TTL logic level)',
        'D1 / TX': 'Serial transmit pin (0V / 5V TTL logic level)',
        'D2 - D13': 'Digital general purpose I/O pins (pins 3, 5, 6, 9, 10, 11 support PWM)',
        'A0 - A5': 'Analog input pins connected to the 10-bit ADC converter',
        '5V': 'Regulated 5V output power source',
        '3.3V': 'Regulated 3.3V output power source (Max 50mA)',
        'GND': 'Ground reference pins',
      }
    }
  },
  {
    id: 'esp32',
    name: 'ESP32 DevKit v1 (ESP-WROOM-32)',
    category: 'Microcontroller / IoT',
    voltage: '3.3V (Operating)',
    description: 'A powerful, low-cost microcontroller board featuring integrated Wi-Fi and Bluetooth. Widely used for Internet of Things (IoT) applications, robotics, and advanced sensors.',
    details: {
      pins: '30 Pins (digital, ADC, DAC, touch)',
      maxCurrent: '12 mA per I/O pin',
      freq: '240 MHz (Dual Core)',
      parameters: [
        { label: 'SRAM', value: '520 KB' },
        { label: 'ROM', value: '448 KB' },
        { label: 'Wireless Protocol', value: '802.11 b/g/n (Wi-Fi) & Bluetooth v4.2 BR/EDR and BLE' },
        { label: 'ADC Resolution', value: '12-bit (0 - 4095 range)' },
      ],
      pinoutDescription: {
        'EN': 'Enable pin (Reset board when pulled LOW)',
        '3V3': 'Regulated 3.3V output power source',
        'GND': 'Ground reference pins',
        'D2 / GPIO2': 'Digital pin, also connected to the on-board blue LED',
        'D15 / GPIO15': 'Hardware serial TX / JTAG pin',
        'D21 / SDA': 'I2C communication data pin',
        'D22 / SCL': 'I2C communication clock pin',
      }
    }
  },
  {
    id: 'led',
    name: '5mm LED (Light Emitting Diode)',
    category: 'Output Indicator',
    voltage: '1.8V - 2.2V (Forward Volts)',
    description: 'Standard 5mm light emitting diode used for status signals, debug logs, and visual blink indicators.',
    details: {
      pins: '2 Pins (Anode, Cathode)',
      maxCurrent: '20 mA (Absolute Max)',
      parameters: [
        { label: 'Recommended Current', value: '10 - 15 mA' },
        { label: 'Anode (A)', value: 'Positive terminal (longer leg, curved leg)' },
        { label: 'Cathode (K)', value: 'Negative terminal (shorter leg, flat edge of casing)' },
        { label: 'Peak Wavelength', value: '625 nm (Red LED)' },
      ],
      pinoutDescription: {
        'Anode (A)': 'Connects to MCU pin (with series resistor)',
        'Cathode (K)': 'Connects to GND'
      }
    }
  },
  {
    id: 'dht11',
    name: 'DHT11 Temperature & Humidity Sensor',
    category: 'Sensor',
    voltage: '3.5V - 5.5V',
    description: 'A basic, ultra low-cost digital temperature and humidity sensor. It uses a capacitive humidity sensor and a thermistor to measure the surrounding air.',
    details: {
      pins: '3 Active Pins (VCC, DATA, GND)',
      maxCurrent: '2.5 mA active draw (during conversion)',
      parameters: [
        { label: 'Humidity Range', value: '20 - 90% RH (5% accuracy)' },
        { label: 'Temperature Range', value: '0 - 50 °C (±2°C accuracy)' },
        { label: 'Sampling Period', value: '1 second (do not read faster than this)' },
      ],
      pinoutDescription: {
        'VCC': 'Positive voltage supply (3.5V to 5.5V)',
        'DATA': 'Single-bus bi-directional serial data pin',
        'GND': 'Ground reference connection'
      }
    }
  },
  {
    id: 'potentiometer',
    name: '10k Rotary Potentiometer',
    category: 'Analog Input Sensor',
    voltage: '0V - VCC (Analog range)',
    description: 'A 3-terminal variable resistor. Used as an adjustable voltage divider to supply analog inputs to microcontrollers (e.g. for volume dials, dimmer values).',
    details: {
      pins: '3 Pins (VCC, SIG, GND)',
      maxCurrent: '0.5 mA (Power efficiency standard)',
      parameters: [
        { label: 'Total Resistance', value: '10,000 Ω (10k)' },
        { label: 'Rotation Angle', value: '300 degrees' },
        { label: 'Power Rating', value: '0.125 Watts' },
      ],
      pinoutDescription: {
        'VCC (Pin 1)': 'Connected to 5V or 3.3V power source',
        'SIG / Wiper (Pin 2)': 'Output voltage pin connected to MCU analog read pin',
        'GND (Pin 3)': 'Connected to system GND'
      }
    }
  }
];

export const Datasheets: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<DatasheetItem | null>(null);

  const filteredDB = DATASHEET_DB.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="datasheet-container">

      {/* Search Input Wrapper */}
      <div className="search-wrapper">
        <Search className="search-icon" size={14} />
        <input
          type="text"
          placeholder="Search components or categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* List items */}
      <div className="datasheet-list">
        {filteredDB.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="datasheet-card"
          >
            <div className="datasheet-card-info">
              <span className="datasheet-card-title">
                {item.name}
              </span>
              <span className="datasheet-card-meta">{item.category} • {item.voltage}</span>
            </div>
            <Eye size={14} className="datasheet-card-icon" />
          </div>
        ))}
      </div>

      {/* Datasheet detail modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content text-slate-200 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedItem.name}</h3>
                <span className="modal-subtitle">{selectedItem.category}</span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-section">
                <h4 className="modal-section-title">General Description</h4>
                <p className="modal-section-text">{selectedItem.description}</p>
              </div>

              <div className="modal-grid-2">
                <div className="modal-grid-cell">
                  <h4 className="modal-section-title">Pins & Interfaces</h4>
                  <span className="modal-section-text">{selectedItem.details.pins}</span>
                </div>
                <div className="modal-grid-cell">
                  <h4 className="modal-section-title">Nominal Logic Level</h4>
                  <span className="modal-section-text">{selectedItem.voltage}</span>
                </div>
              </div>

              <div className="modal-section">
                <h4 className="modal-section-title">Electrical Parameters</h4>
                <table className="modal-table">
                  <tbody>
                    {selectedItem.details.parameters.map((p, idx) => (
                      <tr key={idx} className="modal-table-row">
                        <td className="modal-table-label">{p.label}</td>
                        <td className="modal-table-value">{p.value}</td>
                      </tr>
                    ))}
                    <tr className="modal-table-row">
                      <td className="modal-table-label">Max Pin Current Draw</td>
                      <td className="modal-table-value">{selectedItem.details.maxCurrent}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="modal-section">
                <h4 className="modal-section-title">Pin Mapping Dictionary</h4>
                <div className="modal-pin-list font-mono">
                  {Object.entries(selectedItem.details.pinoutDescription).map(([pin, desc]) => (
                    <div key={pin} className="modal-pin-card">
                      <span className="modal-pin-name">{pin}</span>
                      <span className="modal-pin-desc">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setSelectedItem(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
