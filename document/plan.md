# Project Plan: Roblox R6 AI Animator

This plan outlines the development phases and specific tasks required to build the Roblox R6 Animation platform.

## 📅 Phase 1: Project Setup & Scaffolding
- [x] Initialize Next.js project with TypeScript and App Router.
- [x] Install core dependencies: `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `lucide-react`.
- [x] Setup project folder structure as defined in `ideas.md`.
- [x] Configure Tailwind CSS (or Vanilla CSS) for the UI components.

## 🧱 Phase 2: Core 3D Environment & R6 Rig
- [x] Create a basic 3D Scene with lighting, floor, and OrbitControls.
- [x] Develop the `R6Model` component:
    - [x] Define the 6 body parts (Head, Torso, Arms, Legs) using basic primitives (boxes) or loading mesh data.
    - [x] Implement the hierarchical structure (Parenting parts to the Torso).
    - [x] Setup initial pivot points for natural rotations.
- [x] Implement basic pose application logic (passing rotation data to parts).

## ⚙️ Phase 3: Animation Engine & State Management
- [x] Setup Zustand store (`useAnimationStore`) to manage:
    - [x] Current Frame.
    - [x] Keyframe data (Pose at specific frames).
    - [x] Playback state (Playing, Paused, Loop).
- [x] Develop the `InterpolationEngine`:
    - [x] Implement SLERP logic for smooth Quaternion rotations between keyframes.
    - [x] Implement LERP logic for position transitions.
    - [x] Create a playback loop that calculates and updates the R6 model every frame.

## 🎞️ Phase 4: UI/UX & Timeline Development
- [x] Build the `Timeline` component:
    - [x] Frame track with markers.
    - [x] Playback controls (Play/Pause, Stop, Next/Prev Frame).
    - [x] Keyframe manipulation (Add, Delete, Move).
- [x] Build the `Controls` panel:
    - [x] Manual rotation sliders/inputs for selected body parts.
    - [x] Pose presets (Idle, Walk, Punch).

## 🧠 Phase 5: AI Integration (Text & Vision)
- [x] Setup API routes:
    - [x] `/api/ai-text`: Proxy to Ollama for Text-to-Pose conversion.
    - [x] `/api/ai-vision`: Image upload handling and Ollama Vision analysis.
- [x] Implement `AI Prompt` UI:
    - [x] Text input for describing animations.
    - [x] Logic to parse AI JSON response into keyframes.
- [x] Implement `Image Uploader` UI:
    - [x] File selection and preview.
    - [x] Frame-by-frame analysis logic.

## ✨ Phase 6: Refinement & Export
- [x] Add visual polish (Character textures, environment shadows).
- [x] Implement Export feature:
    - [x] Export as Roblox-compatible Keyframe sequence (JSON).
- [x] Final testing and performance optimization for the 3D canvas.
- [x] Implement Inverse Kinematics (IK) for limbs — one-bone R6 IK assist (arms, legs, head-look) with reach clamping + torso translation compensation; FK/IK mode toggle, `Bake IK` writes the solved pose to the current keyframe, `Mirror Pose` swaps L↔R across the sagittal plane. See `lib/rig/`.
- [x] Add Undo/Redo support — 50-snapshot history stack wraps every pose-mutating action (addKeyframe, removeKeyframe, moveKeyframe, updatePartRotation/Position, setTotalFrames, clearKeyframes, bakeIK, mirror); Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y shortcuts; toolbar buttons.

---

## 🛠️ Immediate Tasks (Next Steps)
1. ~~Implement Inverse Kinematics (IK)~~ — done.
2. ~~Add Undo/Redo~~ — done.
3. Enhance Export/Import to support Roblox KeyframeSequence XML format (current export is a custom JSON clip; Roblox Studio import would need XML-serialised KeyframeSequence).
4. Optional: viewport IK effector gizmos (task01 Phase 3). V1 uses numeric inputs + the existing rotate/translate gizmos on body parts.
