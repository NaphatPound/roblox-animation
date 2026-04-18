# Project Plan: Roblox R6 AI Animator

This plan outlines the development phases and specific tasks required to build the Roblox R6 Animation platform.

## 📅 Phase 1: Project Setup & Scaffolding
- [ ] Initialize Next.js project with TypeScript and App Router.
- [ ] Install core dependencies: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `lucide-react`.
- [ ] Setup project folder structure as defined in `ideas.md`.
- [ ] Configure Tailwind CSS (or Vanilla CSS) for the UI components.

## 🧱 Phase 2: Core 3D Environment & R6 Rig
- [ ] Create a basic 3D Scene with lighting, floor, and OrbitControls.
- [ ] Develop the `R6Model` component:
    - [ ] Define the 6 body parts (Head, Torso, Arms, Legs) using basic primitives (boxes) or loading mesh data.
    - [ ] Implement the hierarchical structure (Parenting parts to the Torso).
    - [ ] Setup initial pivot points for natural rotations.
- [ ] Implement basic pose application logic (passing rotation data to parts).

## ⚙️ Phase 3: Animation Engine & State Management
- [ ] Setup Zustand store (`useAnimStore`) to manage:
    - [ ] Current Frame.
    - [ ] Keyframe data (Pose at specific frames).
    - [ ] Playback state (Playing, Paused, Loop).
- [ ] Develop the `InterpolationEngine`:
    - [ ] Implement SLERP logic for smooth Quaternion rotations between keyframes.
    - [ ] Implement LERP logic for position transitions.
    - [ ] Create a playback loop that calculates and updates the R6 model every frame.

## 🎞️ Phase 4: UI/UX & Timeline Development
- [ ] Build the `Timeline` component:
    - [ ] Frame track with markers.
    - [ ] Playback controls (Play/Pause, Stop, Next/Prev Frame).
    - [ ] Keyframe manipulation (Add, Delete, Move).
- [ ] Build the `Controls` panel:
    - [ ] Manual rotation sliders/inputs for selected body parts.
    - [ ] Pose presets (Idle, Walk, Punch).

## 🧠 Phase 5: AI Integration (Text & Vision)
- [ ] Setup API routes:
    - [ ] `/api/ai-text`: Proxy to Ollama for Text-to-Pose conversion.
    - [ ] `/api/ai-vision`: Image upload handling and Ollama Vision analysis.
- [ ] Implement `AI Prompt` UI:
    - [ ] Text input for describing animations.
    - [ ] Logic to parse AI JSON response into keyframes.
- [ ] Implement `Image Uploader` UI:
    - [ ] File selection and preview.
    - [ ] Frame-by-frame analysis logic.

## ✨ Phase 6: Refinement & Export
- [ ] Add visual polish (Character textures, environment shadows).
- [ ] Implement Export feature:
    - [ ] Export as Roblox-compatible Keyframe sequence (JSON or XML).
- [ ] Final testing and performance optimization for the 3D canvas.

---

## 🛠️ Immediate Tasks (Getting Started)
1. `npx create-next-app@latest roblox-r6-animator --typescript --tailwind --eslint`
2. `npm install three @types/three @react-three/fiber @react-three/drei zustand`
3. Initialize the basic `Scene.tsx` and `R6Model.tsx`.
