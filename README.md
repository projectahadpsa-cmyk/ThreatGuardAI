# ThreatGuardAI — Network Intrusion Detection System

## Overview

ThreatGuardAI is a professional-grade network security monitoring and intrusion detection platform. It leverages custom-trained Machine Learning models to analyze network traffic patterns and identify potential threats in real-time.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the integrated Express server & Vite frontend
npm run dev
```

The application will be accessible at **http://localhost:3000**

---

## Project Structure

```
threatguardai/
├── ML/                              ← Directory for ONNX models & scalers
├── public/
│   └── logo.png                     ← System branding
├── src/
│   ├── pages/
│   │   ├── Landing.jsx              ← Public interface
│   │   ├── Dashboard.jsx            ← Security metrics & analytics
│   │   ├── Detection.jsx            ← Real-time & batch analysis
│   │   ├── Results.jsx              ← Detailed threat forensics
│   │   ├── History.jsx              ← Secure audit trail
│   │   └── Profile.jsx              ← Account & preferences
│   ├── components/
│   │   └── soc/                     ← Specialized SOC components
│   ├── context/                     ← Application state management
│   └── services/
│       ├── db.js                    ← Local persistence layer
│       └── api.js                   ← Backend communication service
├── server.ts                        ← Express backend with ONNX inference
├── tailwind.config.js               ← Professional design system
└── vite.config.js                   ← Build & proxy configuration
```

---

## Tech Stack

| Layer       | Technology                           |
|-------------|--------------------------------------|
| Frontend    | React 18 + Vite                      |
| Backend     | Express.js (Node.js)                 |
| ML Engine   | ONNX Runtime (onnxruntime-node)      |
| Styling     | Tailwind CSS                         |
| Icons       | Lucide React                         |
| Charts      | Recharts                             |
| Database    | SQLite (sql.js)                      |
| Animations  | motion/react                         |

---

## Machine Learning Integration

The system utilizes custom ML models for high-precision network intrusion detection:

1. **Neural Network Engine:** Powered by `onnxruntime-node` for real-time inference on `.onnx` models.
2. **Models:** Optimized Random Forest and Data Scaler models are loaded from the `/ML/` directory.
3. **Heuristic Fallback:** A robust rule-based engine ensures continuous protection if neural network models are unavailable.
4. **Feature Importance:** Provides granular insights into why specific traffic was flagged as a threat.

---

## Security & Compliance

- **Role-Based Access Control (RBAC):** Distinct permissions for standard users and system administrators.
- **Secure Audit Trail:** Every scan is logged with a persistent record for forensic analysis.
- **Data Privacy:** Localized database storage ensures sensitive network metadata remains within the controlled environment.

---

## Build & Deployment

```bash
# Generate production build
npm run build

# Start production server
npm start
```
