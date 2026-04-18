# Project Logs

This file tracks features, bugs, fixes, and updates to the Roblox R6 AI Animator project.

---

## 2026-04-18

### [INIT] Project Scaffold Created
- Created Next.js 14 (App Router) + TypeScript project structure.
- Installed deps: `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `lucide-react`, `jest`, `ts-jest`.
- Folder structure set up per `ideas.md` / `plan.md`.

### [FEATURE] Math Utilities
- Implemented `clamp`, `lerp`, `lerpVec3`, `degToRad`, `radToDeg`, `applyEasing`.
- Implemented Euler-Quaternion conversion and **SLERP** (Spherical Linear Interpolation).
- `slerpEuler` wraps SLERP for convenient Euler-angle interpolation — used by InterpolationEngine to avoid Gimbal Lock.

### [FEATURE] Zustand Animation Store
- Manages keyframes, current frame, playback state, selected body part.
- Supports add / remove / move / update keyframes (always sorted by frame).
- Clamping guards on `currentFrame`, `totalFrames`, `fps`, `speed`.

### [FEATURE] Interpolation Engine
- `findBracketingKeyframes`: binary-safe bracket search around a frame.
- `interpolatePose`: blends two keyframes with SLERP for rotations and LERP for positions, with optional easing.
- `advanceFrame`: playback loop helper with loop/clamp behavior.

### [FEATURE] 3D Viewport
- `R6Model.tsx`: 6-part rig (head, torso, left/right arm, left/right leg) with per-part selection highlight.
- `Scene.tsx`: Canvas, lights, shadows, grid floor, OrbitControls.

### [FEATURE] UI Components
- `Timeline.tsx`: play/pause/stop/loop, keyframe add/delete, scrubber, FPS/speed/frame inputs.
- `PromptInput.tsx`: Text-to-Animation prompt → `/api/ai-text` → new keyframe.
- `ImageUploader.tsx`: multiple image upload → per-frame `/api/ai-vision` analysis.
- `Controls.tsx`: body-part selector with XYZ rotation sliders + reset.

### [FEATURE] Ollama API Integration
- `lib/ollama.ts`: `generatePoseFromText`, `generatePoseFromImage`, `extractJson`, `normalizePose`, `fallbackPoseFromPrompt`.
- Routes: `/api/ai-text`, `/api/ai-vision` (POST).
- Env: `OLLAMA_URL` (default `http://localhost:11434`), `OLLAMA_TEXT_MODEL` (default `llama3.2`), `OLLAMA_VISION_MODEL` (default `gemma3`).
- Graceful fallback on Ollama errors: heuristic pose based on prompt keywords.

### [TESTS] Jest Suite Created
- `__tests__/mathUtils.test.ts`: 30+ cases covering clamp/lerp/slerp/euler-quaternion round-trip.
- `__tests__/useAnimationStore.test.ts`: keyframe CRUD, playback state, clamping.
- `__tests__/InterpolationEngine.test.ts`: bracket search, interpolation, frame advancement.
- `__tests__/ollama.test.ts`: JSON extraction, pose normalization, fallback heuristics.

### [TEST RESULT] First Run — 70/70 passed
- `npx jest` → 4 suites, 70 tests passed in 1.4s.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → compiled successfully, 6 static pages generated.

### [BUGFIX] Playback speed ignored user FPS setting
- File: `components/3d/R6Model.tsx` in the `useFrame` callback.
- Before: `const frameDelta = delta * 30;` — hardcoded 30 fps, so raising FPS in the timeline didn't actually speed up playback.
- After: `const frameDelta = delta * fps;` — uses the live `fps` value from the store.
- Added regression test in `__tests__/InterpolationEngine.test.ts` verifying `advanceFrame` scales with arbitrary fps (60 → 30 frames per 0.5s, 24 → 12 frames).

### [BUGFIX] Image-to-Animation frame spacing was broken
- File: `components/ui/ImageUploader.tsx`.
- Before: computed an unused `frame` variable, then called `addKeyframe(i * Math.max(1, Math.floor(fps / 4)), ...)`. With many images the keyframes silently overflowed past `totalFrames` and got clamped/dropped.
- After: precomputes a `step` of `max(1, floor(fps/4))`, expands `totalFrames` via `setTotalFrames` when the sequence would exceed the current timeline length, then evenly distributes keyframes at `i * step`.

### [TEST RESULT] After Fixes — 71/71 passed
- All existing tests still pass, plus the new FPS regression test.
- `npx tsc --noEmit` → 0 errors.

---

## 2026-04-19

### [FEATURE] 3D Model Generation
- Generated a standard Roblox R6 character model in `.obj` format.
- Location: `public/models/r6_model.obj` and `public/models/r6_model.mtl`.
- The model includes 6 distinct parts: Head, Torso, LeftArm, RightArm, LeftLeg, and RightLeg.
- Proportions and positions are set according to standard Roblox R6 specifications for easy animation.

### [QA] Ran dev server and browsed localhost:3000
- `npx next dev` started, compiled in ~5.3s, page loaded at http://localhost:3000.
- Exercised: preset buttons, body-part selection, rotation sliders, frame scrubbing, keyframe add, play, Generate Pose (fallback used since Ollama not running).

### [BUG] Body parts overlapped each other (visual regression)
- Before: torso `x=±1` (width 2) + arms at `x=±1.2` (width 1) → arms overlapped torso by 0.3 studs; legs at `x=±0.4` (width 1) merged into a single leg; head `y=2.5` (h=1) collided with torso top `y=2.2` by 0.2.
- Diagnosed from browser screenshots — the character looked like a single fused block rather than 6 separate parts.

### [BUG] Rotations pivoted at part center, not at joints
- Rotating `rightArm.x = 90` swung the arm around its own middle instead of around the shoulder — the arm ended up inside the torso and below the waist. Same for legs (not hips) and head (not neck).
- Made realistic animations impossible without painful position compensation.

### [BUG] T-Pose and Wave preset rotation signs flipped
- T-Pose set `leftArm.z=+90, rightArm.z=-90` which rotates the hanging arm `(0,-1,0)` *into* the torso instead of outward. Same sign mistake in `fallbackPoseFromPrompt` "wave" and "punch" branches.
- Verified with a matrix calc: for an arm hanging at local `(0,-1,0)`, rotating `+90°` around Z maps it to `(+1, 0, 0)` — so right-outward needs `+90` on the right arm, **not** `-90`.

### [FIX] Rewrote `components/3d/R6Model.tsx` with a joint hierarchy
- Each part is a nested `<group position={jointPosition} rotation={...}>` with the mesh pushed off-center via `<mesh position={MESH_OFFSETS[name]}>`. Result: rotations pivot at shoulder/hip/neck.
- Added proper R6 proportions: head `1.2³`, torso `2×2×1`, limbs `1×2×1`; joints laid out so no two parts overlap.
- Introduced a simple `<Face />` (two eye spheres + mouth bar) nested inside the head group so the face rotates with the head — provides an orientation cue that was previously missing.
- Updated `Scene.tsx` ground to `y=-3` (feet line), larger shadow map, finer grid, tighter orbit clamp.

### [FIX] Preset + fallback rotation signs corrected
- `lib/presets.ts` T-Pose and Wave: flipped Z signs so arms extend outward instead of into the torso.
- `lib/ollama.ts` `fallbackPoseFromPrompt`: rewrote to use `x`-axis forward punches (matches the new joint convention), added left-side variants via `p.includes('left')`, added `t-pose`, `crouch`, `jab` keyword handlers.
- Tests in `__tests__/ollama.test.ts` and `__tests__/presets.test.ts` updated to assert the new (correct) axes and signs.

### [FEATURE] Pose presets panel
- `lib/presets.ts` exposes 10 presets: Idle, T-Pose, Wave, Punch R/L, Kick R, Run R/L, Jump, Crouch.
- `components/ui/Controls.tsx` renders a `Pose Presets` grid at the top; clicking a preset calls `addKeyframe(round(currentFrame), preset())` so users can lay down animations in a couple of clicks.

### [FEATURE] Export / Import JSON animations
- New `components/ui/ExportPanel.tsx` — downloads the current timeline as a JSON `AnimationClip` (`{name, duration, fps, keyframes[]}`) and restores it via a file picker.
- Validation/sanitization extracted to `lib/animationClip.ts` (`isValidPose`, `sanitizeClip`, `toAnimationClip`) so the logic is unit-testable independent of the DOM.
- Also adds a "Clear All Keyframes" button wired to the store.

### [ENHANCEMENT] Timeline polish
- Scrubber `step` now `1` (was `0.1`) so scrubbing lands on integer frames that match keyframes.
- Keyframe markers are clickable — clicking one seeks `currentFrame` to that keyframe. Active marker turns orange; others stay yellow.
- Marker `left` now divides by `max(1, totalFrames)` so a timeline with `totalFrames=0` wouldn't divide-by-zero.

### [TESTS] Added 24 new tests across two new suites
- `__tests__/animationClip.test.ts` — 13 tests covering `isValidPose` (accept full pose, reject missing parts, reject bad types), `sanitizeClip` (null/bad input, drop invalid entries, sort by frame, default fps/duration, floor non-integer frames), and `toAnimationClip` (deep clone, passthrough fps/duration).
- `__tests__/presets.test.ts` — 5 tests asserting every `PRESET_ORDER` entry has a factory, every preset produces a valid `R6Pose`, Punch and T-Pose set the expected joints, and repeated invocations return independent objects.
- Existing `ollama.test.ts` expanded from 4 to 8 cases (left/right variants, t-pose, jab, kick default arm).

### [TEST RESULT] Final — 94/94 passed
- `npx jest` → 6 suites, 94 tests passed in ~0.8s.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → compiled successfully, /page bundle now 9.52 kB (up from 8.02 kB with the new panels).
- Verified in Chrome: T-Pose spreads arms laterally, Wave raises right arm up-right, Punch R throws the right arm forward from the shoulder, SLERP at `frame=15` between T-Pose and Wave shows a smooth mid-transition pose (both arms rotating proportionally — proves quaternion interpolation not Euler).
