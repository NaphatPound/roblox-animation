# Task: Add R6 Rig + IK Assist

## Objective

Add a new animation feature that lets users animate the Roblox R6 model by dragging rig handles instead of editing only Euler sliders. The feature should introduce an **R6-compatible IK assist layer** on top of the existing rig and allow users to **bake solved poses into keyframes**.

## Current Baseline

- `components/3d/R6Model.tsx` already has a usable hierarchical joint structure rooted at the torso.
- `store/useAnimationStore.ts` stores final keyframe poses only.
- `components/ui/Controls.tsx` edits rotations directly in FK style.
- `components/3d/InterpolationEngine.ts` already handles playback/interpolation once a pose exists.

This means the missing piece is not basic rigging anymore. The missing piece is an **interactive rig control layer and solver**.

## Important Constraint

Roblox **R6 does not have true upper/lower arm or upper/lower leg bones**. Each arm and leg is a single rigid segment connected to the torso.

That creates a hard limit:

- full 2-bone humanoid IK with elbow/knee bending is **not possible** on pure R6
- a hand or foot can only move on a sphere around the shoulder/hip unless the torso also moves

## Decision

Implement a **hybrid R6 IK assist**, not full humanoid IK.

V1 should support:

- hand and foot targets
- torso/root compensation
- optional head look target
- pinning for feet/hands
- bake solved result into the current keyframe

V1 should **not** try to fake elbows/knees with extra bones.

## Feature Goals

Users should be able to:

1. switch between `FK` and `IK` editing modes
2. drag hand and foot targets in the 3D viewport
3. move the torso while keeping pinned feet stable
4. preview the solved pose in real time
5. bake the current solved pose into a keyframe
6. reset or mirror the rig quickly

## Out Of Scope For V1

- fake elbow or knee joints
- R15 support
- procedural walk cycles
- IK handles stored inside exported animation format
- full DCC-style constraint graph

## Product Behavior

### FK Mode

- current behavior stays available
- users edit joint rotations directly

### IK Mode

- viewport shows draggable effectors:
  - `leftHand`
  - `rightHand`
  - `leftFoot`
  - `rightFoot`
  - optional `headLook`
  - optional `torsoRoot`
- dragging a hand/foot moves the target
- solver rotates the matching limb toward the target
- if target is unreachable, the target is clamped to reachable distance and the UI should show that state clearly
- if a foot is pinned, moving the torso should try to preserve that foot position

### Bake

- solving updates a preview pose first
- pressing `Bake IK` writes the solved `R6Pose` into the current frame
- interpolation and playback continue using baked keyframes only

Pragmatic rule:

- IK targets are **editor state**, not animation state, in V1
- the timeline still stores baked poses, not solver instructions

## Technical Solution

## 1. Add Rig Metadata Layer

Create a dedicated rig definition file:

- `lib/rig/r6Rig.ts`

Responsibilities:

- define joint anchor positions
- define rest directions for limbs
- define effective limb lengths
- define joint limits
- expose helper functions for joint/world conversions

Suggested data:

```ts
export type IKHandleName =
  | 'leftHand'
  | 'rightHand'
  | 'leftFoot'
  | 'rightFoot'
  | 'headLook'
  | 'torsoRoot';

export interface IKTarget {
  enabled: boolean;
  pinned: boolean;
  position: Vec3;
  weight: number;
}

export interface JointLimit {
  x: [number, number];
  y: [number, number];
  z: [number, number];
}
```

Rig constants should match the actual offsets already used in `R6Model.tsx`.

## 2. Add R6 IK Solver

Create:

- `lib/rig/r6IkSolver.ts`

Solver strategy for V1:

### Arm/Leg Solver

For each limb:

1. compute shoulder/hip world position
2. compute vector from joint anchor to target
3. clamp target distance to limb length
4. rotate the limb from its rest direction toward the target direction
5. convert result back to local joint rotation
6. clamp local rotation to joint limits

This is effectively **1-bone IK**, which is the correct match for R6.

### Torso Compensation

Because R6 limbs are short and rigid, targets will often be unreachable unless the torso can help.

V1 torso compensation should be simple:

1. allow torso position changes
2. when one or both feet are pinned, solve a translation offset that reduces foot drift
3. apply torso translation before limb solving

Start with translation-only torso compensation. Rotation-aware torso compensation can be phase 2.

### Head Look

Optional V1 feature:

- add a head look target
- solve head yaw/pitch toward the target
- clamp to sensible limits

## 3. Use Quaternions Internally

Even though stored poses are Euler-based today, the solver should work internally with quaternions and direction vectors.

Reasons:

- more stable for repeated drag updates
- easier direction-to-rotation solving
- matches the rest of the interpolation architecture

After solving:

- convert back to Euler
- clamp
- write into preview pose or baked keyframe

## 4. Add Editor State For IK

Extend `types/index.ts` and `store/useAnimationStore.ts` with:

- `editMode: 'fk' | 'ik'`
- `ikTargets`
- `selectedHandle`
- `previewPose`
- actions for:
  - `setEditMode`
  - `setIkTargetPosition`
  - `toggleIkPin`
  - `resetIkTargets`
  - `solveIkPreview`
  - `bakeIkToCurrentFrame`

Important design choice:

- keep `keyframes` unchanged as the source of truth for playback
- keep `previewPose` separate so drag interactions do not mutate animation until the user chooses to bake

## 5. Add Viewport Handles

Create:

- `components/3d/IKHandles.tsx`

Responsibilities:

- render small gizmos/spheres for effectors
- support dragging in world space
- highlight selected handle
- show pin state

Implementation options:

- use `TransformControls` from `@react-three/drei`
- or implement lightweight plane-drag controls manually

Recommendation:

- use the simplest stable approach first
- do not build a custom full gizmo system unless the existing controls are inadequate

## 6. Integrate Into R6Model

Update `components/3d/R6Model.tsx` so it can:

- render either baked pose or `previewPose`
- expose world anchor positions for shoulders/hips/head
- support overlaying IK handles without breaking playback

The model itself should remain the final renderer. The solver should live outside the render component.

## 7. Update Controls UI

Update `components/ui/Controls.tsx` to add:

- FK / IK mode toggle
- pin toggles for hands/feet
- `Bake IK` button
- `Reset IK` button
- `Mirror Pose` button
- numeric fields for selected handle position

The existing rotation sliders should stay available in FK mode.

## 8. Add Mirror Support

Create:

- `lib/rig/mirrorPose.ts`

Mirror behavior:

- swap left/right arms
- swap left/right legs
- invert yaw/roll where needed
- keep torso/head consistent

This is especially valuable for combat animation authoring.

## 9. Testing

Add tests for:

- `__tests__/r6IkSolver.test.ts`
- store behavior for IK mode
- bake flow
- unreachable target clamping
- pinned foot behavior
- mirror behavior

Minimum solver test cases:

1. right hand target in reachable range rotates right arm toward target
2. unreachable target clamps to max reach
3. left and right feet pinned while torso moves reduces foot drift
4. bake writes solved pose to the current frame
5. solver never returns `NaN` rotations

## File Plan

- `types/index.ts`
  Add IK handle and rig state types.

- `store/useAnimationStore.ts`
  Add IK editor state, preview pose, bake actions.

- `components/3d/R6Model.tsx`
  Render preview pose and expose rig anchor data cleanly.

- `components/3d/IKHandles.tsx`
  Add draggable rig effectors.

- `components/3d/Scene.tsx`
  Mount IK handle overlay when IK mode is active.

- `components/ui/Controls.tsx`
  Add IK controls and bake/reset actions.

- `lib/rig/r6Rig.ts`
  Add anchor definitions, limb lengths, limits.

- `lib/rig/r6IkSolver.ts`
  Add the actual solver.

- `lib/rig/mirrorPose.ts`
  Add pose mirroring helpers.

- `utils/mathUtils.ts`
  Add any missing vector/quaternion helpers if needed.

## Implementation Phases

### Phase 1: Solver Foundation

- create `r6Rig.ts`
- create `r6IkSolver.ts`
- add tests for reachable/unreachable solves
- keep everything headless first, no UI

### Phase 2: Store Integration

- add IK state to the store
- add `previewPose`
- add bake flow

### Phase 3: Viewport Interaction

- add `IKHandles.tsx`
- support dragging targets
- render solved preview live

### Phase 4: Editing UX

- add FK/IK mode switch
- add pin toggles
- add mirror/reset/bake actions

### Phase 5: Stabilization

- clamp edge cases
- remove solver jitter
- verify playback still works

## Acceptance Criteria

- users can switch between FK and IK editing without breaking existing animation playback
- dragging a hand or foot handle updates the pose in real time
- unreachable targets clamp safely and predictably
- pinned feet remain visually stable when moving the torso within solver limits
- `Bake IK` creates or updates the current frame keyframe
- mirrored poses produce sensible left/right swaps
- all new solver/store tests pass

## Risks

### 1. Expectation mismatch

Users may expect full humanoid IK. The UI and docs must clearly explain:

- this is **R6 IK assist**
- arms and legs are single-segment
- elbow/knee bending is not part of R6

### 2. Jitter from Euler conversion

Repeated quaternion-to-Euler conversion can create noisy values. Mitigation:

- solve in quaternion space
- normalize before converting
- clamp and round carefully when baking

### 3. Over-scoping the gizmo system

Custom viewport controls can consume too much time. Keep V1 minimal and stable.

## Final Recommendation

Build this as a **hybrid FK/IK assist system** that respects actual R6 constraints.

The right V1 is:

- one-bone IK for arms and legs
- torso translation compensation
- viewport effectors
- bake-to-keyframe workflow

That will give users a much faster animation workflow without pretending R6 can do full humanoid IK.
