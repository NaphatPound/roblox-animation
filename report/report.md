# Bug Report Handoff

This document summarizes the current runtime/behavioral bugs found in the Roblox R6 AI Animator codebase so another agent can fix them directly.

## Validation Status

- `npm test -- --runInBand`: passed
- `npx tsc --noEmit`: passed
- `npm run lint`: not usable yet because `next lint` opens the interactive ESLint setup flow

Static checks are clean. The issues below are runtime/behavioral problems.

## 1. Editing On In-Between Frames Resets Unedited Parts

Severity: High

### Symptoms

When the user scrubs to a frame that does not already have a keyframe and edits one part in `Controls`, the new keyframe is not based on the current interpolated pose. Instead, most of the body snaps back to the first stored pose.

### Repro

1. Add a keyframe at frame `0`
2. Add a different keyframe at frame `30`
3. Scrub to frame `15`
4. Edit only one axis on one part in the `Controls` panel
5. Observe that the created keyframe at frame `15` resets untouched parts instead of preserving the interpolated pose

### Root Cause

- [Controls.tsx](/G:/project/roblox-animation/components/ui/Controls.tsx:37) reads current values from `interpolatePose(keyframes, currentFrame)`
- [useAnimationStore.ts](/G:/project/roblox-animation/store/useAnimationStore.ts:172) creates missing keyframes from:
  - exact frame pose if present
  - otherwise `state.keyframes[0]?.pose`
  - otherwise `DEFAULT_POSE`

That fallback ignores the actual interpolated pose at the current frame.

### Expected Fix

When `updatePartRotation(frame, part, rotation)` creates a missing keyframe, it should use the interpolated pose at that frame, not the first keyframe pose.

### Likely Fix Area

- [store/useAnimationStore.ts](/G:/project/roblox-animation/store/useAnimationStore.ts:172)

### Acceptance Criteria

- Editing a part at a non-keyed frame preserves all other parts from the current interpolated pose
- Only the edited part changes
- Add a regression test covering edit-at-inbetween-frame behavior

## 2. Non-Looping Playback Never Stops

Severity: High

### Symptoms

With looping disabled, playback reaches the final frame visually but remains in the `playing` state forever. The UI still shows pause, and the render loop keeps dispatching updates.

### Repro

1. Disable loop in the timeline
2. Press play
3. Let the animation reach the end
4. Observe that the frame stops at the end, but playback state does not switch to paused/stopped

### Root Cause

- [InterpolationEngine.ts](/G:/project/roblox-animation/components/3d/InterpolationEngine.ts:85) returns both `frame` and `reachedEnd`
- [R6Model.tsx](/G:/project/roblox-animation/components/3d/R6Model.tsx:142) ignores `reachedEnd`
- The render loop always calls `setCurrentFrame(frame)` and never pauses/stops playback when the clip is finished

### Expected Fix

When loop is off and `advanceFrame(...)` returns `reachedEnd: true`, playback should stop or pause immediately.

### Likely Fix Area

- [components/3d/R6Model.tsx](/G:/project/roblox-animation/components/3d/R6Model.tsx:142)

### Acceptance Criteria

- With loop off, playback automatically exits the playing state at the end
- The Play/Pause button reflects the correct state
- No continuous store updates occur after the end frame is reached
- Add a regression test around end-of-playback state handling

## 3. Export/Import Drops Easing Data

Severity: Medium

### Symptoms

Any easing stored on keyframes is lost after export/import. Motion timing changes after a round trip through JSON.

### Repro

1. Create or inject keyframes with non-linear easing
2. Export JSON
3. Import the same JSON
4. Observe that easing is missing and interpolation becomes linear

### Root Cause

- [InterpolationEngine.ts](/G:/project/roblox-animation/components/3d/InterpolationEngine.ts:58) reads `after.easing`
- [animationClip.ts](/G:/project/roblox-animation/lib/animationClip.ts:32) does not preserve `easing` while sanitizing imports
- [animationClip.ts](/G:/project/roblox-animation/lib/animationClip.ts:59) does not include `easing` during export

### Expected Fix

Preserve valid `easing` values on both export and import.

### Likely Fix Area

- [lib/animationClip.ts](/G:/project/roblox-animation/lib/animationClip.ts:21)
- [lib/animationClip.ts](/G:/project/roblox-animation/lib/animationClip.ts:49)

### Acceptance Criteria

- Exported JSON includes keyframe easing
- Imported JSON restores easing
- Round-tripping a clip keeps interpolation timing unchanged
- Add tests for easing preservation

## 4. Rig Root Offset Does Not Match Ground Assumptions

Severity: Medium

### Symptoms

The character root translation and the scene ground plane are based on different assumptions. Idle, crouch, and jump poses can appear to float or sink relative to the floor.

### Repro

1. Open the scene with default pose
2. Compare feet placement to the ground plane
3. Apply presets such as `crouch` or `jump`
4. Observe vertical mismatch between the rig and the floor

### Root Cause

- [useAnimationStore.ts](/G:/project/roblox-animation/store/useAnimationStore.ts:11) still gives `torso.position` a non-zero world-space offset
- [R6Model.tsx](/G:/project/roblox-animation/components/3d/R6Model.tsx:160) applies `torso.position` as whole-model translation
- [Scene.tsx](/G:/project/roblox-animation/components/3d/Scene.tsx:8) sets `GROUND_Y` assuming torso origin is at `y = 0`
- Presets such as [lib/presets.ts](/G:/project/roblox-animation/lib/presets.ts:70) further modify torso position based on the older offset model

### Expected Fix

Choose one consistent convention:

- either torso/root origin is world `y = 0` and ground is derived from rig dimensions
- or torso/root carries an offset and ground is placed relative to that offset

The current mix of both is incorrect.

### Likely Fix Area

- [store/useAnimationStore.ts](/G:/project/roblox-animation/store/useAnimationStore.ts:11)
- [components/3d/R6Model.tsx](/G:/project/roblox-animation/components/3d/R6Model.tsx:160)
- [components/3d/Scene.tsx](/G:/project/roblox-animation/components/3d/Scene.tsx:8)
- [lib/presets.ts](/G:/project/roblox-animation/lib/presets.ts:70)

### Acceptance Criteria

- Feet align sensibly with the ground in the default pose
- Presets do not float or sink unexpectedly unless intentionally animated
- Ground alignment behavior is consistent across playback and manual editing

## Suggested Fix Order

1. Fix in-between-frame editing
2. Fix non-looping playback stop behavior
3. Fix easing round-trip
4. Normalize rig root / ground alignment

## Suggested Tests To Add

- store test for creating a keyframe from interpolated pose at a non-keyed frame
- playback test for stopping at end when `loop = false`
- animation clip import/export test that preserves `easing`
- render/pose-level test or logic test for ground alignment assumptions
