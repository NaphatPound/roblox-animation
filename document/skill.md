# Skill: Building a Roblox R6 AI Animator

This guide outlines the specialized workflow, technical standards, and step-by-step implementation for creating a web-based, AI-driven animation platform for Roblox R6 characters.

## 🛠️ Technical Pre-requisites
- **Next.js (App Router) + TypeScript**: For the core framework.
- **Three.js + React Three Fiber (R3F)**: For 3D rendering.
- **Zustand**: For high-frequency state management (essential for 60fps animation).
- **Ollama**: For local AI vision and text analysis.

---

## 🚀 Step-by-Step Implementation

### Step 1: Mathematical Foundation
Before touching 3D models, you must implement a robust math utility library.
- **Implement SLERP**: Use Quaternions for all rotation interpolations to avoid "Gimbal Lock."
- **Conversion Helpers**: Create `degToRad` and `radToDeg` functions, as Three.js uses radians while users (and AI) prefer degrees.
- **Easing Functions**: Implement Linear, EaseIn, and EaseOut to make movements feel natural.

### Step 2: The R6 Rigging System
Standard 3D models pivot at their geometric center. For R6, you must create a joint-based hierarchy.
- **Joint Groups**: Wrap each body part in a `THREE.Group` that acts as the pivot point (shoulder, hip, neck).
- **Mesh Offsets**: Push the actual mesh away from the group origin so it hangs correctly (e.g., an arm mesh should be offset -1 unit on the Y-axis from its shoulder joint).
- **Torso Root**: Make the Torso the parent of all other parts so moving the torso moves the entire character.

### Step 3: Animation State & Store
The store is the "Brain" of the project.
- **Keyframe Management**: Store poses as a sorted array of keyframes.
- **Current Frame Logic**: Use a single source of truth for `currentFrame`.
- **Action Decoupling**: Separate "Update Rotation" from "Calculate Interpolation."

### Step 4: The Interpolation Engine
This engine calculates what the character looks like *between* your saved keyframes.
- **Binary Search**: Efficiently find the two keyframes closest to the current frame.
- **Blending**: Perform SLERP on rotations and LERP on positions.
- **Playback Loop**: Use `useFrame` (R3F) to advance the frame based on Delta time to ensure smooth playback regardless of CPU speed.

### Step 5: Interactive Viewport (Gizmos)
Don't rely solely on sliders.
- **Click-to-Select**: Use raycasting (built into R3F) to select body parts.
- **TransformControls**: Attach draggable handles directly to the joints for intuitive posing.

### Step 6: AI Integration
- **Ollama Proxy**: Create Next.js API routes to handle communication with local AI models.
- **Structured JSON**: Prompt the AI to return data in a specific JSON format (e.g., `{"rightArm": {"x": 45, ...}}`).
- **Heuristic Fallback**: Always implement a hard-coded "keyword fallback" (e.g., if the user says "punch," apply a preset) in case the AI fails or is offline.

---

## ✅ MUST DO (Best Practices)

1.  **ALWAYS Use Quaternions**: Euler angles will eventually glitch and flip during complex rotations.
2.  **Strict Typing**: Define interfaces for `R6Pose`, `Vec3`, and `Keyframe`. This prevents "undefined" errors during interpolation.
3.  **Joint-Relative Positioning**: Store limb positions as deltas from their joints, not as absolute world coordinates.
4.  **Unit Testing**: Write tests for your math functions. A small bug in your SLERP logic will make every animation look "broken."
5.  **Performance Guardrails**: Clamp the number of keyframes and the total timeline length to prevent memory issues.

## ❌ MUST NOT DO (Common Pitfalls)

1.  **NO Euler Interpolation**: Never try to "Lerp" degrees (e.g., lerping 350° to 10° should go through 0°, but Euler-Lerp will spin all the way around 340° backwards).
2.  **Avoid Direct State Mutation**: Never mutate a keyframe object directly. Always use deep clones (`{...pose}`) to prevent React render bugs.
3.  **Don't Load Massive Textures**: Roblox characters are blocky. Keep textures small (256x256) to maintain fast load times.
4.  **Don't Block the Main Thread**: If performing heavy AI analysis, move it to a Web Worker or handle it via an async API route.
5.  **No Absolute Positioning for Limbs**: If you hard-code an arm's position at `(5, 2, 0)`, it will detach from the body when the character walks. Always use the hierarchy.

---

## 🛠️ Tooling & Validation
- **Jest**: Run `npx jest` after every math change.
- **TypeScript**: Run `npx tsc --noEmit` to check for type safety.
- **Format**: Use a standard `.obj` loader for the R6 model to ensure compatibility.
