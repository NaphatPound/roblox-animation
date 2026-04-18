# Report 02: Current Bugs For Fix Agent

This handoff captures the bugs that still exist in the current codebase after the earlier fixes.

## Validation Run

- `npm test -- --runInBand`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: skipped

These findings are based on code review of the active implementation paths, especially the newer gizmo translation workflow and the import pipeline.

## 1. Translated limbs snap back instead of interpolating to the default joint position

Severity: High

### Symptoms

If a user translates a non-torso part with the gizmo at one keyframe and then creates a later keyframe with that part back at the default pose, playback does not smoothly move the part back. The limb stays offset for the whole span and then snaps back only on the exact keyframe where the stored `position` becomes `undefined`.

This affects the new gizmo-based translation workflow directly.

### Repro

1. Select `rightArm`
2. Switch gizmo mode to `Move`
3. At frame `0`, drag the arm to add a non-zero `rightArm.position`
4. At frame `30`, add a default pose keyframe where `rightArm.position` is not set
5. Play the animation
6. Observe that the arm stays offset until frame `30` and then snaps back, instead of interpolating gradually

### Root Cause

- [interpolatePose](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:69>) only lerps positions when both keyframes define `position`
- if only one side has a `position`, it falls back to `from.position || to.position`
- [DEFAULT_POSE](</G:/project/roblox-animation/lib/pose.ts:3>) leaves non-torso part positions as `undefined`
- preset and default keyframes therefore mean "no stored offset", not an explicit zero offset

So transitions between:

- `{ position: { x: 0.5, y: 0, z: 0 } }`
- and `position: undefined`

are treated as hold-then-snap rather than interpolate-to-zero.

### Expected Fix

Treat missing non-torso positions as zero offset during interpolation.

Practical options:

1. Normalize all parts to explicit zero vectors before interpolation
2. In `interpolatePose`, treat missing `position` as `{ x: 0, y: 0, z: 0 }`
3. Keep export compact if needed, but do not let `undefined` break motion interpolation

### Likely Fix Area

- [components/3d/InterpolationEngine.ts](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:41>)
- possibly [lib/pose.ts](</G:/project/roblox-animation/lib/pose.ts:3>) if the team prefers explicit zero offsets

### Suggested Regression Test

Add a test where:

- frame `0` has `rightArm.position = { x: 1, y: 0, z: 0 }`
- frame `30` has `rightArm.position = undefined`
- frame `15` should produce roughly `{ x: 0.5, y: 0, z: 0 }`, not `{ x: 1, y: 0, z: 0 }`

## 2. Image-to-animation import always starts at frame 0 and overwrites existing work

Severity: Medium

### Symptoms

The image import pipeline ignores the current playhead position and always writes analyzed frames at:

- `0`
- `step`
- `2 * step`
- etc.

This means importing image frames into a partially edited timeline can silently overwrite existing keyframes near the beginning of the clip.

### Repro

1. Create or import an animation with existing keyframes near frame `0`
2. Move the playhead to a later frame, for example `30`
3. Upload a set of image frames through `ImageUploader`
4. Run analysis
5. Observe that the generated keyframes are still inserted starting at frame `0`

### Root Cause

- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:45>) calculates `step`
- [ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:61>) writes to `addKeyframe(i * step, data.pose)`
- the component does not read `currentFrame` from the store

### Expected Fix

Use the current playhead as the insertion offset, or let the user choose a start frame explicitly.

Minimum acceptable fix:

- start at `Math.round(currentFrame)` instead of always `0`
- extend `totalFrames` relative to that start frame

### Likely Fix Area

- [components/ui/ImageUploader.tsx](</G:/project/roblox-animation/components/ui/ImageUploader.tsx:14>)

### Suggested Regression Test

Add a test or component-level assertion that image analysis beginning at frame `30` inserts keyframes at:

- `30`
- `30 + step`
- `30 + 2 * step`

## 3. Imported clips do not validate `position` data

Severity: Medium

### Symptoms

`sanitizeClip` validates rotations but accepts any `position` object shape that happens to be present inside the pose. Invalid imported position payloads can be copied into the store and then fed straight into Three.js object transforms.

This can lead to:

- malformed scene transforms
- string-like position values leaking into the renderer
- hard-to-debug bad imports that pass sanitization

### Repro

Import JSON with a pose like:

```json
{
  "keyframes": [
    {
      "frame": 0,
      "pose": {
        "head": { "rotation": { "x": 0, "y": 0, "z": 0 }, "position": { "x": "bad", "y": 0, "z": 0 } },
        "torso": { "rotation": { "x": 0, "y": 0, "z": 0 }, "position": { "x": 0, "y": 0, "z": 0 } },
        "leftArm": { "rotation": { "x": 0, "y": 0, "z": 0 } },
        "rightArm": { "rotation": { "x": 0, "y": 0, "z": 0 } },
        "leftLeg": { "rotation": { "x": 0, "y": 0, "z": 0 } },
        "rightLeg": { "rotation": { "x": 0, "y": 0, "z": 0 } }
      }
    }
  ]
}
```

The clip will pass `isValidPose`, because only rotation is checked.

### Root Cause

- [isValidPose](</G:/project/roblox-animation/lib/animationClip.ts:13>) only validates that each part has numeric rotation values
- [sanitizeClip](</G:/project/roblox-animation/lib/animationClip.ts:30>) then clones the whole pose, including any invalid `position` object
- [R6Model.tsx](</G:/project/roblox-animation/components/3d/R6Model.tsx:71>) later reads `positionOffset?.x/y/z` directly into group positions

### Expected Fix

Extend import validation so `position`, when present, must be a finite numeric `Vec3`.

Practical rule:

- if `position` is invalid, either drop it or reject the keyframe

### Likely Fix Area

- [lib/animationClip.ts](</G:/project/roblox-animation/lib/animationClip.ts:13>)
- possibly add a reusable `isValidVec3` helper

### Suggested Regression Test

Add import tests that:

- reject string-valued positions
- reject non-object positions
- preserve valid numeric positions

## 4. Imported clips can contain duplicate frame numbers, which leaves timeline behavior inconsistent

Severity: Medium

### Symptoms

The import path keeps multiple keyframes at the exact same frame. That creates inconsistent behavior between:

- interpolation
- marker rendering
- nearest-keyframe deletion

The timeline and interpolation code assume unique frame positions much more strongly than the import sanitizer does.

### Repro

Import JSON with two keyframes both at frame `10` but different poses.

Observed effects:

- the timeline can render overlapping markers at the same x-position
- delete only removes one of them at a time
- exact-frame interpolation behavior depends on first/last duplicate ordering

### Root Cause

- [sanitizeClip](</G:/project/roblox-animation/lib/animationClip.ts:35>) collects valid keyframes
- [sanitizeClip](</G:/project/roblox-animation/lib/animationClip.ts:57>) sorts them
- it never deduplicates by `frame`

Meanwhile:

- [findBracketingKeyframes](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:14>) uses first/last matching semantics
- [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:35>) uses `.find(...)` for the nearest keyframe

Those behaviors do not stay consistent when multiple keys share one frame.

### Expected Fix

Normalize imported clips to one keyframe per frame.

Options:

1. keep the last keyframe for each frame
2. keep the first keyframe for each frame
3. reject duplicate-frame imports as invalid

Whatever rule is chosen should be explicit and tested.

### Likely Fix Area

- [lib/animationClip.ts](</G:/project/roblox-animation/lib/animationClip.ts:30>)

### Suggested Regression Test

Import a clip with duplicate frame values and assert that:

- only one keyframe remains at each frame
- exact-frame interpolation returns a deterministic pose

## Suggested Fix Order

1. Fix non-torso position interpolation
2. Fix image import start-frame behavior
3. Harden clip import validation for `position`
4. Normalize duplicate imported frames
