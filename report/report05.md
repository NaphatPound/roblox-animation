# Report 05: Current Bug Review

This handoff captures the bugs I found in the current codebase that are not covered by the existing reports.

## Validation Run

- `npm test -- --runInBand`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: skipped

The issues below are runtime and state-management bugs that still exist despite the passing tests.

## 1. Looping playback skips the terminal frame entirely

Severity: High

### Symptoms

When looping is enabled, playback wraps to frame `0` as soon as it reaches `totalFrames`. The last frame is treated as if it were outside the clip, even though the timeline UI, scrubber, and keyframe editor all allow keyframes at that exact frame.

This means a keyframe placed at the end of the clip can never actually be shown during looped playback.

### Repro

1. Create keyframes at frame `0` and frame `60`
2. Leave looping enabled
3. Play the animation
4. Observe that playback jumps from just before frame `60` back to frame `0`
5. The frame `60` pose is never displayed while looping

### Root Cause

- [InterpolationEngine.ts](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:95>) treats `totalFrames` as an exclusive upper bound for looping
- [InterpolationEngine.ts](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:98>) wraps with `next % totalFrames`
- [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:125>) and [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:138>) treat `totalFrames` as an inclusive frame index

So playback and editing disagree about whether the last frame is part of the clip.

### Expected Fix

Pick one convention and use it everywhere.

Practical options:

1. Keep `totalFrames` as an inclusive max frame and only wrap when `next > totalFrames`
2. Convert the app to an exclusive frame-count model and update the timeline/UI accordingly

### Likely Fix Area

- [components/3d/InterpolationEngine.ts](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:88>)
- possibly [components/ui/Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:123>)

### Suggested Regression Test

Add a test asserting that looped playback can still land on and display the exact end frame before wrapping.

## 2. Reducing `totalFrames` strands hidden keyframes past the end of the clip

Severity: High

### Symptoms

If the user shortens the timeline after creating keyframes near the end, those keyframes are not removed or clamped. They remain in the store beyond the new end of the clip.

This causes multiple bad outcomes:

- hidden markers render beyond the visible timeline
- the user cannot scrub to those frames anymore
- interpolation before the new end can still depend on a hidden future keyframe
- export can produce JSON whose `duration` is shorter than some keyframe frame numbers

### Repro

1. Create a keyframe at frame `50`
2. Change `Total Frames` to `30`
3. Observe that:
   - the playhead can no longer reach frame `50`
   - the keyframe still exists in the store
   - export still includes that frame `50` keyframe even though the clip duration is now `30`

### Root Cause

- [useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:132>) only updates `totalFrames` and clamps `currentFrame`
- it does not trim, clamp, or warn about keyframes beyond the new duration
- [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:176>) lets the user shrink the duration directly
- [ExportPanel.tsx](</G:/project/roblox-animation/components/ui/ExportPanel.tsx:19>) exports the current `totalFrames` value unchanged

### Expected Fix

When the duration is reduced, keep store invariants consistent.

Reasonable options:

1. Remove keyframes past the new end
2. Clamp them onto the new end frame
3. Block the reduction unless the user confirms how to handle out-of-range keyframes

### Likely Fix Area

- [store/useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:132>)
- [components/ui/Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:170>)
- [components/ui/ExportPanel.tsx](</G:/project/roblox-animation/components/ui/ExportPanel.tsx:18>)

### Suggested Regression Test

Add a store test that shrinks `totalFrames` below an existing keyframe and asserts that no keyframe remains beyond the new end.

## 3. Fractional playhead edits write the wrong pose into the rounded frame

Severity: Medium

### Symptoms

The editor stores `currentFrame` as a float during playback, but several editing actions round only the destination frame number, not the sampled pose they are editing.

So if playback is paused at something like frame `9.6`, the editor can sample the pose from `9.6` and write it into frame `10`. If frame `10` already had a keyframe, this silently overwrites the exact end pose with a near-end interpolated pose.

### Repro

1. Create keyframes at frame `0` and frame `10` with visibly different poses
2. Play the animation and pause around frame `9.6`
3. Click `Keyframe`, or adjust a rotation slider in `Controls`
4. Observe that frame `10` is now overwritten with the pose sampled from the fractional playhead, not the true frame `10` pose

### Root Cause

- [R6Model.tsx](</G:/project/roblox-animation/components/3d/R6Model.tsx:170>) advances `currentFrame` as a float
- [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:31>) samples pose at the raw fractional `currentFrame`
- [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:32>) writes that pose to `Math.round(currentFrame)`
- [Controls.tsx](</G:/project/roblox-animation/components/ui/Controls.tsx:61>) also reads values from the fractional pose
- [Controls.tsx](</G:/project/roblox-animation/components/ui/Controls.tsx:67>) writes them back to `Math.round(currentFrame)`

### Expected Fix

Editing should use one frame coordinate consistently.

Reasonable options:

1. Snap `currentFrame` to an integer before editing
2. Sample the pose at `Math.round(currentFrame)` before writing
3. Disable editing while the playhead is fractional

### Likely Fix Area

- [components/ui/Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:30>)
- [components/ui/Controls.tsx](</G:/project/roblox-animation/components/ui/Controls.tsx:61>)
- possibly [components/3d/R6Model.tsx](</G:/project/roblox-animation/components/3d/R6Model.tsx:170>)

### Suggested Regression Test

Add a UI or store-level test that pauses on a fractional frame, creates a keyframe at the rounded frame, and verifies the stored pose matches the rounded frame rather than the fractional sample.

## 4. `moveKeyframe` can create duplicate-frame collisions and invalid frame numbers

Severity: Medium

### Symptoms

The store exposes a `moveKeyframe(id, newFrame)` action, but unlike `addKeyframe` and imported clip sanitization, it does not enforce the app's one-keyframe-per-frame behavior and does not clamp the destination frame.

If a future drag/drop UI or direct store call uses it, the store can end up with:

- two keyframes at the same frame
- negative frame numbers
- frames beyond the clip duration

Once duplicate frames exist, exact-frame playback, marker selection, and deletion disagree about which keyframe is "the" keyframe at that frame.

### Root Cause

- [useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:104>) rewrites only the `frame` field and sorts
- it does not deduplicate or clamp
- [InterpolationEngine.ts](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:26>) and [InterpolationEngine.ts](</G:/project/roblox-animation/components/3d/InterpolationEngine.ts:54>) resolve duplicate exact-frame matches differently from
- [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:35>) and [Timeline.tsx](</G:/project/roblox-animation/components/ui/Timeline.tsx:115>)

### Expected Fix

Make `moveKeyframe` preserve the same invariants as the rest of the app.

Minimum acceptable behavior:

1. Clamp `newFrame` into the valid timeline range
2. Collapse same-frame collisions deterministically
3. Add a regression test for moving onto an occupied frame

### Likely Fix Area

- [store/useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:104>)

### Suggested Regression Test

Move one keyframe onto another keyframe's frame and assert that only one keyframe remains there and playback/delete behavior stays deterministic.

## Suggested Fix Order

1. Fix the loop end-frame off-by-one
2. Enforce consistent keyframe bounds when shrinking the timeline
3. Make fractional-frame edits deterministic
4. Harden `moveKeyframe` to match the app's existing invariants
