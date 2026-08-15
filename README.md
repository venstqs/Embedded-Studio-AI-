<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/venstqs/Embedded-Studio-AI-/main/public/favicon.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/venstqs/Embedded-Studio-AI-/main/public/logo-black.svg">
    <img alt="XavierLabs Logo" src="https://raw.githubusercontent.com/venstqs/Embedded-Studio-AI-/main/public/favicon.svg" width="80" height="80">
  </picture>
  <h1 align="center">XavierLabs IDE</h1>
  
  <p align="center">
    <strong>A next-generation web-based embedded systems IDE for STE (Science, Technology & Engineering) students.</strong>
    <br />
    Learn electronics and firmware programming without expensive physical hardware.
  </p>

  <p align="center">
    <a href="https://venstqs.github.io/Embedded-Studio-AI-/"><strong>Explore the Live App »</strong></a>
    <br />
    <br />
    <a href="https://github.com/venstqs/Embedded-Studio-AI-/actions/workflows/deploy.yml"><img src="https://github.com/venstqs/Embedded-Studio-AI-/actions/workflows/deploy.yml/badge.svg" alt="Deploy Status" /></a>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-19-blue.svg?logo=react" alt="React 19" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?logo=typescript" alt="TypeScript" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-Powered-purple.svg?logo=vite" alt="Vite" /></a>
  </p>
</div>

<hr />

## What is XavierLabs IDE?

XavierLabs IDE is a beautifully designed, purely client-side browser application that simulates **Arduino** and **ESP32** development environments. Modeled with a **SpaceX-inspired dark aesthetic**, it feels extremely premium, fast, and lightweight.

It empowers students to:
- **Write firmware** in a VS Code-inspired code editor with syntax highlighting.
- **Design circuits** on an interactive, drag-and-drop 2D canvas with photorealistic SVG components.
- **Simulate behavior** including LED glowing (with real PWM support), button presses, potentiometer readings, and DHT11 sensor data.
- **Analyze power consumption** dynamically based on live simulation state and PWM duty cycles.
- **Debug & Learn** using an integrated **AI Copilot** powered by Google Gemini, capable of detecting wiring mismatches and offering step-by-step guidance.
- **Load Starter Kits** with 1-click Circuit Templates like "Blink," "PWM Dimmer," and "DHT11 Sensor."

Everything runs **100% in your browser**—no backend, no downloads, no physical hardware required.

---

## Key Features

- **Advanced UI/UX**: Premium dark mode design, neon glows, glassmorphism, micro-animations, and a highly polished Workspace Explorer with inline file renaming.
- **Dynamic Simulation Engine**: The IDE performs static analysis on your code and simulates real pin voltages. LEDs glow based on calculated duty cycles!
- **AI Copilot Integration**: Ask questions, and the IDE feeds your exact wiring diagram and codebase directly into Google Gemini for highly contextual help.
- **Power Analyzer**: See real-time current draw estimates (mA), USB limits, and battery life forecasts that respond dynamically to your running simulation.
- **Circuit Templates**: Beautiful template cards allow you to instantly load predefined hardware setups and starter code.
- **Zero-Backend Architecture**: State is persisted seamlessly to `localStorage`. Projects survive a browser refresh.

---

## Supported Hardware

### Microcontrollers
- **Arduino Uno R3** (ATmega328P)
- **ESP32 DevKit v1** (ESP-WROOM-32)

### Components
- **Red / Green LEDs**
- **220 Ohm Resistor**
- **Push Button**
- **10k Ohm Potentiometer**
- **DHT11 Temperature & Humidity Sensor**
- **Half-size Breadboard**

---

## Getting Started Locally

To run the project on your own machine:

```bash
# 1. Clone the repository
git clone https://github.com/venstqs/Embedded-Studio-AI-.git
cd Embedded-Studio-AI-

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Configuration (Optional)

The AI Copilot works out-of-the-box using a built-in mock response engine. To unlock **full AI capabilities**, simply grab a free Google Gemini API key and paste it into the **Settings** panel (gear icon in the top-right of the IDE).

---

## Deployment (GitHub Pages)

This repository is equipped with a ready-to-use GitHub Actions workflow (`.github/workflows/deploy.yml`).

1. Push your code to the `main` branch.
2. Ensure **GitHub Pages** is enabled in your repository settings and set to source from **GitHub Actions**.
3. Your site will automatically build and deploy!

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 19 + TypeScript |
| **Build Tool** | Vite 8 |
| **Styling** | Vanilla CSS (Custom Design System) |
| **AI Engine** | Google Gemini 1.5 Flash API |
| **Icons** | Lucide React |

---

<div align="center">
  <i>Built for STE students everywhere. Design inspired by the future.</i>
  <br>
  <b>XavierLabs 2026</b>
</div>
