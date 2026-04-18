import type { R6PartName, R6Pose, Vec3 } from '@/types';
import { clonePose } from '@/lib/pose';
import {
  JOINT_ANCHORS,
  LIMB_LENGTHS,
  REST_DIRECTION,
  IK_HANDLE_TO_PART,
  type IKHandleName,
} from '@/lib/rig/r6Rig';
import { radToDeg } from '@/utils/mathUtils';

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalise(v: Vec3): Vec3 {
  const len = length(v);
  if (len < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Build a local Euler rotation (degrees, XYZ order) that rotates the
 * rest direction `from` onto the target direction `to`.
 *
 * For R6 limbs the rest direction is (0, -1, 0) (hanging straight down).
 * We decompose the rotation into:
 *   - pitch around local X (how far forward/back the limb swings)
 *   - roll around local Z  (how far outward the limb swings)
 * We leave local Y (twist) at zero — R6 limbs are rigid cylinders so
 * twist has no visible effect on the end-effector position.
 */
export function directionToEuler(from: Vec3, to: Vec3): Vec3 {
  const a = normalise(from);
  const b = normalise(to);
  // If target is zero or coincident with rest, no rotation is needed.
  if (length(a) < 1e-9 || length(b) < 1e-9) {
    return { x: 0, y: 0, z: 0 };
  }
  // Rotation around X: tilt from the Y-Z plane.
  //   Starting from (0, -1, 0), a rotation of +theta around +X moves
  //   the tip to (0, -cos(theta), +sin(theta)).
  //   So pitchX = atan2(b.z, -b.y)  (assuming rest -Y convention).
  // Rotation around Z: tilt from the X-Y plane.
  //   Starting from (0, -1, 0), a rotation of +psi around +Z moves the
  //   tip to (sin(psi), -cos(psi), 0).
  //   So rollZ = atan2(b.x, -b.y).
  // Because we solve one limb at a time and twist (Y) is irrelevant,
  // we approximate by taking pitchX from the YZ projection and rollZ
  // from the XY projection. This yields (xDeg, 0, zDeg).
  // For arbitrary 3-D targets this is an approximation that gives a
  // decent visual solution; the limb will aim toward `to` closely
  // enough for R6's rigid-segment rig.

  // Use the rest direction sign to adapt: if rest dir points +Y (head),
  // invert the mapping.
  const restIsUp = a.y > 0.5;
  // JS quirk: Math.atan2(0, -0) === Math.PI, which leaks π into a
  // "no rotation" result whenever b.y is exactly 0 and the result
  // would otherwise be 0. Neutralise -0 before passing to atan2.
  const posY = b.y || 0;
  const negY = -b.y || 0;

  if (restIsUp) {
    // Rest (0,+1,0) → rotate around +X by pitch lands at (0,cos,sin).
    const pitchX = Math.atan2(b.z, posY);
    const rollZ = Math.atan2(-b.x, posY);
    return { x: radToDeg(pitchX), y: 0, z: radToDeg(rollZ) };
  }

  // Rest (0,-1,0) → rotate around +X by pitch lands at (0,-cos,-sin).
  // Target (0,0,1) wants sin=-1 → pitch = -π/2 (arm swings forward).
  const pitchX = Math.atan2(-b.z, negY);
  const rollZ = Math.atan2(b.x, negY);
  return { x: radToDeg(pitchX), y: 0, z: radToDeg(rollZ) };
}

function clampTargetToReach(anchor: Vec3, target: Vec3, reach: number): Vec3 {
  const v = sub(target, anchor);
  const d = length(v);
  if (d <= reach || d < 1e-9) return target;
  const k = reach / d;
  return {
    x: anchor.x + v.x * k,
    y: anchor.y + v.y * k,
    z: anchor.z + v.z * k,
  };
}

export interface LimbSolveResult {
  rotation: Vec3; // Euler degrees, XYZ
  clamped: boolean; // true if target was outside reach
}

/**
 * One-bone IK — rotate a limb from its rest direction toward the target.
 * Works in the rig-local frame (torso origin at world zero).
 */
export function solveLimbIK(
  part: R6PartName,
  target: Vec3,
  torsoRoot: Vec3 = { x: 0, y: 0, z: 0 }
): LimbSolveResult {
  const anchorLocal = JOINT_ANCHORS[part];
  const anchorWorld: Vec3 = {
    x: anchorLocal.x + torsoRoot.x,
    y: anchorLocal.y + torsoRoot.y,
    z: anchorLocal.z + torsoRoot.z,
  };
  const reach = LIMB_LENGTHS[part];
  const clampedTarget = clampTargetToReach(anchorWorld, target, reach);
  const clamped = clampedTarget !== target;

  const dir = normalise(sub(clampedTarget, anchorWorld));
  const rest = REST_DIRECTION[part];
  const rotation = directionToEuler(rest, dir);
  return { rotation, clamped };
}

export interface SolveResult {
  pose: R6Pose;
  clamped: Partial<Record<IKHandleName, boolean>>;
}

/**
 * Solve a full pose from a map of IK targets. Starts from `basePose`
 * so joints that have no target keep their current rotation.
 */
export function solveIKPose(
  basePose: R6Pose,
  targets: Partial<Record<IKHandleName, Vec3>>
): SolveResult {
  const pose = clonePose(basePose);
  const torsoRoot = pose.torso.position || { x: 0, y: 0, z: 0 };
  const clamped: Partial<Record<IKHandleName, boolean>> = {};

  for (const handle of Object.keys(targets) as IKHandleName[]) {
    const target = targets[handle];
    if (!target) continue;
    const part = IK_HANDLE_TO_PART[handle];
    const result = solveLimbIK(part, target, torsoRoot);
    // Guard against NaN / Infinity from degenerate targets.
    if (
      !Number.isFinite(result.rotation.x) ||
      !Number.isFinite(result.rotation.y) ||
      !Number.isFinite(result.rotation.z)
    ) {
      continue;
    }
    pose[part] = { ...pose[part], rotation: result.rotation };
    if (result.clamped) clamped[handle] = true;
  }
  return { pose, clamped };
}

/**
 * Torso-translation compensation: given a set of pinned targets
 * (feet, hands) and the current rig root, find a root translation that
 * reduces drift between the pinned targets and their reachable limb tips.
 *
 * V1 implementation: average the deltas between each pinned target's
 * anchor in world and the current anchor position, and apply as a
 * translation. Simple, not exact, but enough to keep a pinned foot
 * on the ground while the torso moves slightly.
 */
export function compensateTorso(
  currentRoot: Vec3,
  pinnedTargets: Partial<Record<IKHandleName, Vec3>>
): Vec3 {
  const entries = (Object.keys(pinnedTargets) as IKHandleName[])
    .map((handle) => {
      const target = pinnedTargets[handle];
      if (!target) return null;
      const part = IK_HANDLE_TO_PART[handle];
      const anchorLocal = JOINT_ANCHORS[part];
      const rest = REST_DIRECTION[part];
      const reach = LIMB_LENGTHS[part];
      // Where the anchor would need to be so the rest-pose tip lands on target.
      return {
        x: target.x - (anchorLocal.x + rest.x * reach),
        y: target.y - (anchorLocal.y + rest.y * reach),
        z: target.z - (anchorLocal.z + rest.z * reach),
      };
    })
    .filter((e): e is Vec3 => e !== null);

  if (entries.length === 0) return currentRoot;
  const avg = entries.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: avg.x / entries.length,
    y: avg.y / entries.length,
    z: avg.z / entries.length,
  };
}
