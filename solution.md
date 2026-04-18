# Solution for Roblox R6 AI Animator

## Project Status

This repository is already a good prototype. It has the right base stack for the problem:

- `Next.js 14` + `TypeScript` for the app shell
- `React Three Fiber` for viewport rendering
- `zustand` for timeline and playback state
- quaternion SLERP-based interpolation in `components/3d/InterpolationEngine.ts`
- local AI integration through Ollama in `lib/ollama.ts`
- a working test baseline with 71 passing tests

What exists today is an **AI-assisted pose editor prototype**, not yet a full Roblox animation tool. The code is clean enough to continue, but the next work should focus on correctness, exportability, and editing workflow.

## Main Problems To Solve

### 1. The rig is not a true Roblox-style joint hierarchy

In `components/3d/R6Model.tsx`, body parts are rendered as separate meshes with independent world positions. That means the torso does not naturally drive the head, arms, and legs like a real R6 rig.

Impact:

- poses do not behave like Roblox `Motor6D` joints
- torso rotation looks wrong
- export to Roblox will be harder and less accurate

### 2. AI currently creates a single pose, not a real animation clip

`/api/ai-text` and `/api/ai-vision` currently return one `pose`. That is useful for blocking, but not enough for text-to-animation.

Impact:

- prompt-to-animation feels shallow
- users still have to manually build most keyframes
- no duration, timing, style, or easing comes from AI

### 3. Vision input is analyzed frame-by-frame without temporal smoothing

`components/ui/ImageUploader.tsx` sends each image independently to `/api/ai-vision`. There is no confidence threshold, pose stabilization, or smoothing pass after analysis.

Impact:

- jitter between frames
- unstable arm and leg angles
- inconsistent motion when frames are visually similar

### 4. There is no Roblox export pipeline yet

The current internal pose model is editor-friendly, but there is no export layer for Roblox animation data.

Impact:

- users cannot move finished work into Roblox Studio
- the tool has no clear end-to-end output

### 5. The editor workflow is still minimal

The current timeline is usable, but still missing core animator features.

Missing pieces:

- drag-to-move keyframes
- duplicate/copy/paste/mirror keyframes
- easing editor per keyframe
- undo/redo
- save/load project
- clip library and preset system

### 6. AI failures are too silent

`lib/ollama.ts` falls back to heuristic poses when Ollama fails. That keeps the UI responsive, but the user cannot clearly tell whether the result came from the model or from fallback logic.

Impact:

- lower trust in generated results
- harder debugging
- harder prompt iteration

## Recommended Product Direction

The best direction is:

**AI-assisted R6 animation blocking and cleanup tool**

Workflow:

1. User enters a prompt or uploads image frames
2. System generates a draft pose sequence
3. User edits keyframes in the timeline
4. System smooths/interpolates motion
5. User exports Roblox-ready animation data

This is a better product direction than trying to make AI produce perfect final animation in one step.

## Recommended Technical Solution

### A. Fix the rig foundation first

Replace the current free-floating part layout in `components/3d/R6Model.tsx` with a hierarchical rig:

- root
- torso pivot
- head pivot attached to torso
- left arm pivot attached to torso
- right arm pivot attached to torso
- left leg pivot attached to torso
- right leg pivot attached to torso

Each pivot should rotate locally, and the visible mesh should be offset from the joint pivot. This will make the preview behave much closer to Roblox R6.

### B. Upgrade the data model from pose editing to clip editing

Extend `types/index.ts` and `store/useAnimationStore.ts` to support projects and clips, not only a flat keyframe list.

Suggested model:

```ts
interface AnimationProject {
  id: string;
  name: string;
  clips: AnimationClip[];
  activeClipId: string;
}

interface AnimationClip {
  id: string;
  name: string;
  fps: number;
  totalFrames: number;
  keyframes: Keyframe[];
}

interface AIGenerationMeta {
  source: 'model' | 'fallback';
  confidence?: number;
  warnings?: string[];
  raw?: string;
}
```

This will make save/load, export, multi-clip editing, and AI metadata much easier.

### C. Change AI text generation from single pose to keyframe sequence

Update `app/api/ai-text/route.ts` and `lib/ollama.ts` so the AI can return:

- clip name
- total duration
- fps suggestion
- keyframes at important beats
- easing hints

Suggested response shape:

```json
{
  "clip": {
    "name": "Right Hook Punch",
    "fps": 30,
    "totalFrames": 24,
    "keyframes": [
      { "frame": 0, "pose": {} },
      { "frame": 8, "pose": {} },
      { "frame": 14, "pose": {} },
      { "frame": 24, "pose": {} }
    ]
  },
  "source": "model",
  "confidence": 0.74
}
```

That turns text input into actual animation authoring instead of one-frame insertion.

### D. Improve the image-to-animation pipeline

Keep the current Ollama vision route, but add a post-processing stage:

1. analyze each frame
2. normalize all poses into the same schema
3. smooth noisy rotations across neighboring frames
4. optionally reduce redundant frames into key poses
5. insert only meaningful keyframes into the timeline

Recommended logic:

- median or moving-average smoothing on rotations
- confidence threshold to reject bad frames
- optional left/right mirroring correction
- optional frame sampling to avoid overloading Ollama

### E. Add Roblox export as a first-class feature

Create a dedicated export utility, for example:

- `lib/exporters/roblox.ts`

First export target should be simple and practical:

- JSON format that maps frame numbers to part rotations

Second export target:

- Lua table or Roblox plugin-friendly payload

Later target:

- `KeyframeSequence` compatible structure

Without export, the app stays a demo.

### F. Surface AI provenance in the UI

When a result is generated, show:

- model name
- whether output came from Ollama or fallback
- confidence if available
- raw JSON toggle for debugging

This should be added to `PromptInput.tsx` and `ImageUploader.tsx`.

## Best Enhancement Ideas

These are the highest-value upgrades for this project:

1. Real R6 joint rig with local pivots
2. Multi-keyframe text-to-animation generation
3. Vision smoothing and confidence-aware import
4. Roblox JSON/Lua export
5. Save/load project files
6. Undo/redo history
7. Keyframe drag, duplicate, mirror, and easing editor
8. Pose preset library: idle, walk, run, punch, kick, jump
9. Clip library: combat, movement, emotes
10. Onion-skin or ghost preview of previous/next poses
11. Camera presets: front, side, top, isometric
12. Motion cleanup tools: mirror left/right, reset selected part, lock torso, lock feet

## Priority Roadmap

### Phase 1: Make the animation correct

- refactor `R6Model.tsx` into a true pivot hierarchy
- standardize local joint rotations
- clean up frame semantics in the store
- expose AI source/fallback status

### Phase 2: Make the tool usable

- add drag-and-drop keyframe editing
- add duplicate/delete/mirror actions
- add undo/redo
- add project save/load

### Phase 3: Make AI genuinely useful

- text prompt returns multi-keyframe clips
- image import gets smoothing and frame reduction
- add prompt templates for combat and movement

### Phase 4: Make output usable in Roblox

- add JSON export
- add Lua export
- map editor rig values to Roblox-friendly joint output

## File-Level Recommendations

- `components/3d/R6Model.tsx`
  Replace independent meshes with parent-child pivot groups.

- `store/useAnimationStore.ts`
  Evolve from one global timeline into project/clip state with history support.

- `types/index.ts`
  Add project, clip, export, and AI metadata types.

- `lib/ollama.ts`
  Return structured AI metadata and multi-keyframe generation support.

- `components/ui/Timeline.tsx`
  Add direct keyframe manipulation, easing, duplication, and better frame markers.

- `components/ui/Controls.tsx`
  Add pose mirroring, numeric precision, and optional local/global mode.

- `components/ui/ImageUploader.tsx`
  Add frame sampling, confidence reporting, and smoothing options.

- `app/api/ai-text/route.ts`
  Accept richer generation requests like duration, style, and action type.

- `app/api/ai-vision/route.ts`
  Return per-frame metadata and warnings, not only pose data.

## Recommended Immediate Next Steps

If you want the fastest path to a much better product, do these three tasks next:

1. Refactor the rig into a real hierarchical R6 pivot system
2. Add export support for Roblox-friendly animation JSON
3. Upgrade AI text generation from one pose to a small keyframe sequence

## Final Assessment

This project is worth continuing. The stack choice is correct, the codebase is organized, and the math/interpolation foundation is already in place. The main gap is that the app currently proves the concept, but it does not yet model Roblox rig behavior or produce exportable animation clips.

If the next development phase focuses on **rig correctness**, **clip generation**, and **Roblox export**, this can become a genuinely useful AI-assisted animation tool instead of only a technical prototype.
