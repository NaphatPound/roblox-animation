# Report 06: IK Review Handoff

This handoff covers bugs in the current IK / mirror / undo generation of the editor that are not already captured in the earlier reports.

## Validation Run

- `npm test -- --runInBand`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: not run

These issues are runtime and editor-behavior bugs. The current tests do not cover them.

## 1. `Bake` solves every IK handle, so adjusting one target can reset unrelated joints

Severity: High

### Symptoms

The IK bake path always applies all five handles:

- `leftHand`
- `rightHand`
- `leftFoot`
- `rightFoot`
- `headLook`

So if the user wants to adjust only one limb, baking can still overwrite the other limbs and the head using whatever stale target values happen to be sitting in the store.

This makes IK destructive on partially authored poses.

### Repro

1. Create a keyframe where `leftArm` is raised or the head is turned
2. Switch to IK mode
3. Change only `rightHand`
4. Click `Bake`
5. Observe that joints unrelated to the right hand can also change, even though the user never touched those handles

### Root Cause

- [Controls.tsx](</G:/project/roblox-animation/components/ui/Controls.tsx:206>) always exposes every IK handle, but there is no enabled/disabled or pinned/unpinned concept
- [useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:311>) constructs `targetMap` by copying every handle from `IK_HANDLES`
- [useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:315>) passes that full map into `solveIKPose(...)`
- [r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:141>) iterates every provided target and overwrites that part's rotation

The solver already supports partial target maps, but the store never uses that capability.

### Expected Fix

Only solve the handles the user actually intends to bake.

Reasonable options:

1. Track an active / dirty set of IK handles and only include those in `targetMap`
2. Add per-handle enable toggles in the IK UI
3. Seed targets from the current pose and only solve handles whose targets have changed from that seed

### Likely Fix Area

- [store/useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:305>)
- [components/ui/Controls.tsx](</G:/project/roblox-animation/components/ui/Controls.tsx:185>)

### Suggested Regression Test

Add a store test where only `rightHand` is changed, then assert that `leftArm`, `leftLeg`, `rightLeg`, and `head` remain identical after `bakeIkToCurrentFrame()`.

## 2. `Head Look` uses the limb solver, so left/right look becomes sideways head roll instead of yaw

Severity: High

### Symptoms

The `Head Look` control does not behave like a face-forward look target.

If the target moves to the character's right, the solver drives the head with `z` roll, not `y` yaw. The head tilts sideways instead of turning to look right.

Forward targets also pitch the head aggressively because the solver is trying to align the head's local `+Y` axis, not the face direction.

### Repro

1. Switch to IK mode
2. Move `Head Look` to the character's right
3. Click `Bake`
4. Observe that the head tilts sideways rather than turning right

### Root Cause

- [r6Rig.ts](</G:/project/roblox-animation/lib/rig/r6Rig.ts:30>) defines the head rest direction as `+Y`
- [r6Rig.ts](</G:/project/roblox-animation/lib/rig/r6Rig.ts:86>) seeds `headLook` as a point in front of the face
- [r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:68>) uses the same X/Z decomposition for "rest is up" targets that it uses for limb-like segments
- [r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:72>) hardcodes `y: 0`

That means the head-look path is solving the top-of-head vector instead of a face-forward viewing direction.

### Expected Fix

Handle the head separately from limbs.

Practical options:

1. Treat the face as pointing along local `+Z` and solve head look with yaw (`y`) plus pitch (`x`)
2. Add a dedicated head-look solver instead of routing `headLook` through `solveLimbIK`

### Likely Fix Area

- [lib/rig/r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:37>)
- [lib/rig/r6Rig.ts](</G:/project/roblox-animation/lib/rig/r6Rig.ts:28>)

### Suggested Regression Test

Set `headLook` to the character's right and assert that baked head rotation changes `y`, not `z`.

## 3. `Reset` IK targets ignores the current torso translation and jumps back to world-origin defaults

Severity: Medium

### Symptoms

If the torso has been moved away from the origin, pressing `Reset` in IK mode restores targets for a character at world origin rather than for the character's current root position.

The next bake then pulls limbs toward the wrong world-space locations.

This is especially visible after:

- translating the torso with the move gizmo
- using presets like `jump`
- importing animation clips with non-zero `torso.position`

### Repro

1. Move the torso to a non-zero position, or create a jump keyframe
2. Switch to IK mode
3. Click `Reset`
4. Click `Bake`
5. Observe that limbs solve toward origin-based targets instead of neutral positions around the moved torso

### Root Cause

- [r6Rig.ts](</G:/project/roblox-animation/lib/rig/r6Rig.ts:65>) already supports `defaultIKTargets(torsoRoot)`
- [useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:122>) initializes `ikTargets` with `defaultIKTargets()` using the implicit zero root
- [useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:303>) resets targets the same way

The current frame's torso position is never passed through.

### Expected Fix

Reset targets relative to the current frame pose, not a hardcoded zero-root pose.

Minimum acceptable behavior:

1. Read the current frame's `torso.position`
2. Call `defaultIKTargets(torsoRoot)` with that value

Better behavior:

3. Seed targets from the current effector positions of the current pose instead of neutral defaults

### Likely Fix Area

- [store/useAnimationStore.ts](</G:/project/roblox-animation/store/useAnimationStore.ts:303>)
- [lib/rig/r6Rig.ts](</G:/project/roblox-animation/lib/rig/r6Rig.ts:65>)

### Suggested Regression Test

Move the torso root to a non-zero position, reset IK targets, and assert that the reset target coordinates are offset by that torso root.

## 4. IK solve ignores torso rotation, so targets are wrong whenever the torso is twisted

Severity: High

### Symptoms

The rig renderer nests the head, arms, and legs under the rotated torso. But the IK solver computes world anchors as if the torso were only translated, never rotated.

So once the torso is twisted or leaned, the solver uses the wrong shoulder/hip world positions and the wrong local frame for every limb.

This makes IK inaccurate on many existing poses, including punch and twist poses where torso rotation is intentional.

### Repro

1. Create a keyframe with a visible torso rotation, for example `torso.y = 45`
2. Enter IK mode
3. Move a hand target relative to the visible shoulder position
4. Click `Bake`
5. Observe that the solved arm does not align with the rotated torso the user is seeing in the viewport

### Root Cause

- [R6Model.tsx](</G:/project/roblox-animation/components/3d/R6Model.tsx:240>) applies torso translation on the outer rig root
- [R6Model.tsx](</G:/project/roblox-animation/components/3d/R6Model.tsx:244>) applies `pose.torso.rotation` to the torso joint, and all limbs are children of that rotated joint
- [r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:109>) computes `anchorWorld` as `anchorLocal + torsoRoot`
- [r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:138>) passes only `torso.position` through the full solve path

The torso rotation is never applied to anchor positions or rest directions.

### Expected Fix

Solve IK in the torso's actual coordinate frame.

Reasonable options:

1. Rotate anchors and rest directions by the torso rotation before solving
2. Transform targets into torso-local space, solve there, then convert back

### Likely Fix Area

- [lib/rig/r6IkSolver.ts](</G:/project/roblox-animation/lib/rig/r6IkSolver.ts:103>)
- [components/3d/R6Model.tsx](</G:/project/roblox-animation/components/3d/R6Model.tsx:241>)

### Suggested Regression Test

Solve a hand target with `torso.rotation.y != 0` and assert that the solver respects the rotated torso frame rather than the unrotated shoulder anchor.

## Suggested Fix Order

1. Stop `Bake` from solving every handle unconditionally
2. Fix `Head Look` to use yaw/pitch rather than limb roll
3. Apply torso rotation correctly in the IK solver
4. Reset IK targets relative to the current torso root
