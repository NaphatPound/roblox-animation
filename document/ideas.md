# Roblox R6 Animation Project Ideas & Features

This document outlines the core concepts, top features, and technical strategy for the Roblox R6 Animation website project.

## 🚀 Project Vision
Create a web-based platform for creating smooth, high-quality animations for Roblox R6 characters, specifically focusing on combat and basic movements, powered by AI.

## 🌟 Top Features

### 1. AI-Powered Animation Generation
- **Text-to-Animation:** Convert natural language prompts (e.g., "right hook punch", "running") into character keyframes and rotations.
- **Image-to-Pose (Vision AI):** Upload images or sequences of frames. The system uses AI models (like Gemma Vision via Ollama) to analyze poses and map them directly to the R6 character model.

### 2. Professional Animation Tools
- **R6 Character Rig:** Full support for the 6-part R6 model (Head, Torso, Left Arm, Right Arm, Left Leg, Right Leg).
- **Interactive Timeline:** A user-friendly timeline for managing keyframes, including play, pause, and scrubbing controls.
- **Smooth Interpolation (Inbetweening):** 
    - Use **SLERP (Spherical Linear Interpolation)** with Quaternions for natural-looking limb rotations.
    - Use **LERP (Linear Interpolation)** for smooth position transitions.
    - Automated calculation of missing frames between keyframes to ensure fluidity.

### 3. Advanced 3D Viewport
- Real-time 3D rendering using Three.js and React Three Fiber.
- Support for lighting, camera controls, and high-fidelity character previews.

## 🛠️ Recommended Tech Stack
- **Frontend:** Next.js (App Router) + TypeScript.
- **3D Engine:** Three.js, `@react-three/fiber` (R3F), `@react-three/drei`.
- **State Management:** Zustand (optimized for frequent animation state updates).
- **AI Backend:** Ollama Local API (running Gemma Vision, PaliGemma, or LLaVA).
- **Styling:** Vanilla CSS or Tailwind CSS (as per preference).

## 📂 Proposed Project Structure
```text
roblox-r6-animator/
├── app/
│   ├── api/
│   │   ├── ai-vision/     # Image analysis API
│   │   └── ai-text/       # Text-to-animation API
│   ├── page.tsx           # Main Studio UI (Timeline + Viewport)
├── components/
│   ├── 3d/
│   │   ├── R6Model.tsx    # R6 Rig and Logic
│   │   ├── Scene.tsx      # Canvas and Environment
│   │   └── Interpolation.ts # Math for smooth movement
│   ├── ui/
│   │   ├── Timeline.tsx   # Animation controls
│   │   └── Controls.tsx   # AI Prompt and Uploaders
├── store/
│   └── useAnimStore.ts    # Global state for keyframes
└── utils/
    └── math.ts            # SLERP/LERP helper functions
```

## 🧠 Core Mathematical Principles
- **Quaternions over Euler Angles:** To avoid Gimbal Lock and ensure smooth, 360-degree rotations.
- **Automated Inbetweening:** The engine should automatically fill frames between user-defined (or AI-defined) keyframes using mathematical formulas to maintain a high frame rate.
