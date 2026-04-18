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

---

### [REPORT] Handoff bug-report from another agent — `report.md`
- Received a 4-bug handoff listing High/Medium severity issues: in-between-frame edit, non-looping playback, easing round-trip, rig-root/ground mismatch. All 4 verified as real by reading code at the cited line numbers.

### [REFACTOR] Extracted pose primitives to break a latent circular-import
- Moved `DEFAULT_POSE` and `clonePose` from `store/useAnimationStore.ts` into `lib/pose.ts`.
- Store and `InterpolationEngine.ts` now both import from `lib/pose`. Store re-exports `DEFAULT_POSE` / `clonePose` so existing imports elsewhere still compile.
- Needed so the store can `import { interpolatePose } from '@/components/3d/InterpolationEngine'` without a cycle (InterpolationEngine had previously imported `DEFAULT_POSE` from the store).

### [BUGFIX #1] In-between edit no longer resets unedited parts
- `updatePartRotation` used to fall back to `state.keyframes[0]?.pose` when no keyframe existed at the current frame. Editing at frame 15 between keyframes at 0 and 30 would stamp frame 0's untouched parts into the new keyframe.
- Now: when no exact match exists, the base pose comes from `interpolatePose(state.keyframes, frame)` — all unedited parts carry the current visual pose.
- Regression test: `useAnimationStore.test.ts` asserts `leftArm.rotation.x` at frame 15 is between 20° and 40° when the two surrounding keyframes are 0° and 60°.

### [BUGFIX #2] Non-looping playback now stops at the end
- `R6Model`'s `useFrame` destructured `{ frame }` from `advanceFrame(...)` and threw away `reachedEnd`. With `loop=false` the render loop kept ticking against `totalFrames`, the Play/Pause button stayed wrong, and the store kept receiving `setCurrentFrame(totalFrames)` forever.
- Now: `R6Model` also pulls the `pause` action from the store and calls it when `reachedEnd && !loop`.
- Regression tests in `InterpolationEngine.test.ts`: `advanceFrame(58, 60, 1, false, 5)` returns `reachedEnd=true` at `frame=60`; and with `loop=true` also emits `reachedEnd=true` so a loop observer could fire an end-event.

### [BUGFIX #3] Export/Import preserves `easing`
- `sanitizeClip` and `toAnimationClip` in `lib/animationClip.ts` never read or wrote `keyframe.easing`. Round-tripping through JSON silently dropped all non-linear easing.
- Now: easing is parsed via an allow-list (`linear | easeIn | easeOut | easeInOut`) — unknown strings are discarded rather than passed through. The field is only written when present, so keyframes without easing don't get a spurious `"easing": null`.
- Regression tests in `animationClip.test.ts`: round-trips `[easeInOut, linear, easeOut]` intact, drops a made-up `"bounce"`, and omits the key entirely for un-eased frames.

### [BUGFIX #4] Rig root and ground plane now use one convention
- Before: `DEFAULT_POSE.torso.position = {y: 1.2}` (inherited from the earlier primitive-box rendering that used absolute world positions), but `Scene.GROUND_Y = -3` and `R6Model` used joint-relative positions. The torso offset lifted the whole rig 1.2 units above ground in idle. Jump/crouch presets further stacked their own offsets on top.
- Also removed the stale `position` fields on non-torso parts of `DEFAULT_POSE` — they were never read by `R6Model` anymore (joint locations are hard-coded constants) and were misleading.
- After: `DEFAULT_POSE.torso.position = {0,0,0}`. Rig origin = world origin. Rig math (torso half-height 1 + hip offset 1 + leg length 2) gives feet at y=-3, exactly `GROUND_Y`.
- Presets normalised: `jump` → `torso.y = +2` (feet clear ground by 2); `crouch` → `torso.y = -1.5` (bent legs reach ground).
- Regression tests in new `groundAlignment.test.ts` assert: idle feet exactly on ground, non-torso parts carry no baked-in position, jump lifts above ground, crouch leaves bent feet at/near the ground.

### [TEST RESULT] After report fixes — 106/106 passed
- 12 new regression tests added across `useAnimationStore.test.ts`, `InterpolationEngine.test.ts`, `animationClip.test.ts`, and the new `groundAlignment.test.ts`.
- `npx jest` → 7 suites, 106 tests in ~1s.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → OK, /page 9.59 kB.
- Browser verified: idle character stands with feet on grid line; Jump preset shows character lifted, shadow cast on ground below; T-Pose still spreads arms laterally from shoulders.

---

### [FEATURE] In-canvas editor — click-to-select + drag gizmo
- Click a body part directly in the 3D viewport to select it; a drei `TransformControls` gizmo appears on the selected joint.
- **Rotate gizmo** on any part — drag the red/green/blue rings to spin the joint around X/Y/Z. Rotations pivot at the shoulder/hip/neck because the gizmo is attached to the joint's `<group>` via a forwarded ref.
- **Move gizmo** on the torso only — drags the rig root (`rigRootRef`) so `torso.position` moves; other parts auto-disable the Move button because translating a joint origin would desync the rig.
- `TransformControls.onObjectChange` reads the mutated object's rotation/position on every drag tick, converts radians→degrees where relevant, and writes back through `updatePartRotation` / `updatePartPosition`. Those go through the fixed "interpolated pose as base" path from report #1, so dragging at an in-between frame creates a clean keyframe without resetting untouched joints.
- `OrbitControls makeDefault` lets drei auto-disable the orbit camera while the user is dragging a gizmo — no bespoke pointer-event juggling.
- UI: Gizmo section under Body Parts with Rotate/Move toggle (Move is `disabled` unless torso is selected). Keyboard shortcuts: **R** → rotate, **T**/**G** → translate, **Esc** → deselect. Shortcuts ignore focused inputs/textareas so typing in the prompt box doesn't accidentally switch modes.

### [REFACTOR] Forwarded refs for all joints
- `Joint` wrapped in `forwardRef<THREE.Group, JointProps>` so `R6Model` can keep one `RefObject<THREE.Group>` per body part and hand the right one to `TransformControls` when a part is selected.
- Added `rigRootRef` for the outer rig-root `<group>` that holds `torso.position`; that ref is what the Move gizmo attaches to.

### [STORE] New actions `updatePartPosition` + `gizmoMode`
- `updatePartPosition(frame, part, position)` — symmetrical twin of `updatePartRotation`, also uses `interpolatePose` as the base when no exact keyframe exists.
- `gizmoMode: 'rotate' | 'translate'` with `setGizmoMode(mode)` — single source of truth for the gizmo UI and the TransformControls `mode` prop.

### [TESTS] 4 new cases
- `useAnimationStore.test.ts`: gizmoMode defaults to 'rotate'; `setGizmoMode` toggles it; `updatePartPosition` on an in-between frame uses the interpolated base; `updatePartPosition` updates an existing keyframe in place.

### [TEST RESULT] Final — 110/110 passed
- `npx jest` → 7 suites, 110 tests in ~1s.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → OK, /page 10.2 kB (up from 9.59 kB with the gizmo wiring).
- Dev-server note: had to `rm -rf .next` and restart once because a stale `_not-found` compile was serving `/` as 404 after many HMR cycles — HMR state issue, not a code bug.
- Browser verified: clicking Torso + Move shows an X/Y/Z arrow gizmo, dragging the red X-arrow translates the whole rig to the right, sliders reflect the new position; clicking Right Arm + Rotate shows a 3-ring gizmo pivoted at the shoulder.

---

### [FEATURE] Move gizmo now works on every body part
- Previously: Move was limited to the torso (rig root translation). All other parts auto-disabled the Move button.
- Now: every joint can be translated via the gizmo. Torso keeps its special semantic (rig-root translation through `rigRootRef`). For head/arms/legs, `pose[part].position` is treated as a **local offset** added on top of the hard-coded `JOINT_POSITIONS[part]`.
- Implementation:
  - `Joint` accepts an optional `positionOffset?: Vec3` prop and renders at `[jointOrigin.x + offset.x, ...]`.
  - R6Model passes `pose[name].position` into every non-torso `Joint` as the offset.
  - Gizmo change handler now has two translate paths: `torso` → writes the absolute rig-root position; other parts → writes `(obj.position − JOINT_POSITIONS[part])` so the stored value is a clean delta from the joint origin.
  - Move button in `Controls` is no longer disabled; the tooltip now explains the two semantics.
- `interpolatePose` already LERPs positions when present, so two keyframes with different limb offsets blend smoothly between them — no engine change needed.

### [TESTS] Regression for non-torso position
- `useAnimationStore.test.ts`: `updatePartPosition(5, 'rightArm', {x:0.5,y:0,z:0})` writes the offset onto the rightArm keyframe; untouched parts (leftArm) keep `position` as `undefined` so they stay on their default joint origin.

### [TEST RESULT] 111/111 passed
- `npx jest` → 7 suites, 111 tests.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → OK.
- Browser verified: selected Right Arm + Move → dragged the Y arrow up → right arm floated above the shoulder (and the rotation sliders correctly stayed at 0, since Move edits position only).

### [REPORT] report02.md — 4 bugs after the gizmo work
- Re-read the report and verified each against current code. Bug #1 (position snap) was already fixed in `76d6c18`; added the report's exact repro test (`position=1 → undefined` mid should be `0.5`) for symmetry with the existing `undefined → position=2` case.

### [BUGFIX report02 #2] Image-to-animation import now starts at the playhead
- Symptom: dragging the playhead to frame 30 and importing image frames still wrote keyframes at 0, step, 2*step — silently overwriting earlier keyframes.
- Root cause: `ImageUploader` never read `currentFrame` from the store.
- Fix: extracted the slot calculation into `lib/imageImport.ts` as `planImportFrames(count, currentFrame, fps)` → returns `{ start, step, frames, lastFrame }`. `ImageUploader` now calls `addKeyframe(plan.frames[i], pose)` and uses `plan.lastFrame` for the `totalFrames` extension.
- Tests: new `__tests__/imageImport.test.ts` covers start-at-0, start-at-30 (exact report repro), non-integer currentFrame (rounds), negative clamp, tiny fps (step=1 floor), single-image, empty-input.

### [BUGFIX report02 #3] Import now validates `position` payloads
- Symptom: a malformed `position` like `{x: "bad", y: 0, z: 0}` passed `isValidPose` because the old check only looked at `rotation`. That bad vec would be deep-cloned into the store and leak into the renderer.
- Fix: new exported `isValidVec3` helper — requires finite numeric `x`, `y`, `z`. `isValidPose` now checks that if `position` exists on a part, it must pass `isValidVec3`; otherwise the whole pose is invalid (and `sanitizeClip` drops that keyframe).
- Tests: 4 new cases on `isValidVec3` (accepts, rejects non-object, rejects missing/non-numeric, rejects NaN/Infinity) + `isValidPose` case for the exact report payload + `sanitizeClip` case that drops a bad-position keyframe but keeps the good one alongside it.

### [BUGFIX report02 #4] Import deduplicates duplicate frames
- Symptom: importing a clip with two keyframes at frame 10 produced inconsistent behaviour — markers overlapped, delete only removed one at a time, interpolation depended on array order.
- Fix: `sanitizeClip` now collects into a `Map<frame, Keyframe>` so later entries overwrite earlier ones — same "replace at the same frame" rule as the interactive `addKeyframe`.
- Test: `sanitizeClip` with two kfs at frame 10 returns exactly one, and it's the second one (`head.rotation.x === 90`, not `10`).

### [TEST RESULT] After report02 fixes — 130/130 passed
- `npx jest` → 8 suites, 130 tests.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → OK.

---

### [FEATURE] Text-to-Animation now routes through Ollama Cloud
- User reported: Text-to-Animation button ran but the animation didn't change. Root cause: local Ollama wasn't running, so `generatePoseFromText` fell through to `fallbackPoseFromPrompt`, which for most free-form prompts returns `DEFAULT_POSE` — identical to the existing pose, so the user saw no visible change.
- Fix: extended `lib/ollama.ts` with a `callOllama(body)` helper that picks between:
  - **Ollama Cloud** when `OLLAMA_API_KEY` is set — `POST https://ollama.com/api/generate` with `Authorization: Bearer <key>` (per https://docs.ollama.com/api/authentication).
  - **Local daemon** otherwise — `http://localhost:11434` with no auth.
  - Same JSON request/response shape on both sides (model, prompt, stream=false, optional format='json'/images[]).
- Error surfacing: `generatePoseFromText` / `generatePoseFromImage` now return a typed `source: 'cloud' | 'local' | 'fallback'` plus an `error?: string`. `PromptInput` shows a small "via Ollama Cloud" / "keyword fallback" hint and a red warning when the cloud call fails, including the upstream error message. The user can now tell at a glance whether the AI actually ran.
- Config surface:
  - `.env.local` (gitignored) holds `OLLAMA_API_KEY`, `OLLAMA_TEXT_MODEL`, `OLLAMA_VISION_MODEL`.
  - `.env.example` (committed) documents the same keys + defaults + notes about free-tier cloud models.
- First attempt used `glm-5.1:cloud` (from the user's message). Ollama Cloud returned 403 with `{"error":"model is experiencing high volume. while capacity is being added, a subscription is required for access: https://ollama.com/upgrade"}`. Switched to `gpt-oss:120b-cloud` which is on the free tier for the supplied key.
- Browser verified end-to-end: prompt "dramatic bow, head tilted down, torso bent forward, arms hanging at sides" → POST `/api/ai-text` 200 in 7.3s → "via Ollama Cloud" hint appears → the character visibly bows forward (torso rotated forward, head down, arms following). This confirms the cloud call made it all the way back to a correct R6 pose — a prompt the keyword fallback has no keyword for, so the result could not come from the fallback path.

---

### [REPORT] report03.md — 4 bugs exposed by the new cloud path
- Read and verified each bug against current code. All four real. Plus user asked for `gemma4:31b-cloud` on the vision route.

### [BUGFIX report03 #1] Upstream AI failures no longer masquerade as 200 OK
- Symptom: `/api/ai-text` and `/api/ai-vision` ALWAYS returned 200 — even when Ollama returned a 403 / invalid key / model not available. `ImageUploader` treated any 200 as success and imported the heuristic fallback pose as if it were real vision output. Particularly dangerous for batch image imports.
- Fix: both API routes now inspect `result.source`; if it is `'fallback'`, the route returns HTTP 502 with the pose + error still in the body (so callers can degrade gracefully if they want, but the default `res.ok` check blocks silent corruption).
- `ImageUploader` and `PromptInput` now both check `!res.ok || data.source === 'fallback'` and surface the upstream error; neither writes a fallback pose into the timeline.

### [BUGFIX report03 #2] Cloud mode no longer falls through to local model names
- Symptom: defaults were `llama3.2` / `gemma3` — local-style names. A developer who sets only `OLLAMA_API_KEY` (the documented setup) got cloud routing to *non-existent* cloud models, which 403'd, which hit the fallback silently (see #1).
- Fix: `resolveTextModel(backend)` and `resolveVisionModel(backend)` now pick cloud-tagged defaults (`gpt-oss:120b-cloud`, `gemma4:31b-cloud`) when the resolved backend is `cloud`, and local-friendly defaults (`llama3.2`, `gemma3`) when it is `local`. Explicit `OLLAMA_TEXT_MODEL` / `OLLAMA_VISION_MODEL` always win.
- `.env.example` updated to document the resolved defaults. `.env.local` vision model switched to `gemma4:31b-cloud` (user request).

### [BUGFIX report03 #3] Cloud failure now falls back to local before the heuristic
- Symptom: presence of `OLLAMA_API_KEY` forced cloud-only. A valid local daemon + temporary cloud outage → silent keyword fallback.
- Fix: introduced `OLLAMA_BACKEND=auto|cloud|local` (default `auto`). `planAttempts(mode, hasKey)` returns the ordered list of attempts: `auto+key → [cloud, local]`, `auto-no-key → [local]`, `cloud+key → [cloud]`, `cloud-no-key → []`, `local → [local]`. `callOllama` walks that list and uses the first attempt that succeeds. Combined error is thrown only when every configured attempt fails.

### [BUGFIX report03 #4] `source`/`error` promoted to shared types
- `types/index.ts` now exports `AISource` and `AIPoseResult` (extends `AIPoseResponse`). Both `PromptInput` and `ImageUploader` consume `AIPoseResult`; the ad-hoc local `Result` type in `PromptInput` is gone. `ImageUploader` now also shows a "via Ollama Cloud / local / fallback" hint, matching `PromptInput`.

### [TESTS] New `__tests__/ollamaBackend.test.ts`
- 15 cases covering `resolveBackendMode`, `planAttempts`, `resolveTextModel`, `resolveVisionModel`:
  - mode parsing (auto / cloud / local / typo → auto)
  - attempt plans (auto+key → cloud,local; auto no-key → local; cloud no-key → []; local → local)
  - cloud defaults end with `-cloud`, local defaults do not
  - explicit overrides win, blank overrides treated as unset, vision default is `gemma4:31b-cloud`

### [TEST RESULT] After report03 fixes — 146/146 passed
- `npx jest` → 9 suites, 146 tests in ~1s.
- `npx tsc --noEmit` → 0 errors.
- `npx next build` → OK.
- **End-to-end verified against the live cloud:**
  - `POST /api/ai-text {prompt:"wave hello"}` → `HTTP 200`, `"source":"cloud"`, rightArm `x=-70, z=40` (real model output; not the keyword `z=150` fallback).
  - `POST /api/ai-vision` with a 1×1 base64 PNG → `HTTP 200`, `"source":"cloud"`, cold-call ~91 s using `gemma4:31b-cloud`.

### [BUGFIX] In-between frames didn't interpolate position when one side was unset
- Symptom (reported by user): tweening a moved-and-rotated joint, the rotation LERPed but position snapped to whichever keyframe had the offset set — "cal only rotate".
- Root cause: `interpolatePose` in `components/3d/InterpolationEngine.ts` only LERPed `position` when **both** keyframes had one, and otherwise fell back to `from.position || to.position` — a pure snap, not a blend. That is fine when both keyframes set a value, but falls over once the user uses the Move gizmo only on one keyframe (which is the normal case: the initial keyframe has no `position` set, the user adds one at frame 30).
- Fix: if **either** side has a position, treat the missing side as `{x:0, y:0, z:0}` and LERP. Preserves `position = undefined` only when neither keyframe sets one (so default rigging still skips the field on export).
- Regression tests added in `__tests__/InterpolationEngine.test.ts`: LERPs from zero when only one side has position (the reported bug), still LERPs when both sides have position, and keeps `position` undefined when neither side sets it.
- Tests: 114 passing.
