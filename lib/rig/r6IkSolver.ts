import type { R6PartName, R6Pose, Vec3 } from '@/types';
import { clonePose } from '@/lib/pose';
import {
  JOINT_ANCHORS,
  LIMB_LENGTHS,
  REST_DIRECTION,
  IK_HANDLE_TO_PART,
  type IKHandleName,
} from '@/lib/rig/r6Rig';
import {
  conjugateQuaternion,
  eulerToQuaternion,
  radToDeg,
  rotateVec3,
} from '@/utils/mathUtils';

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

function clampTo(value: number, absLimit: number): number {
  return Math.max(-absLimit, Math.min(absLimit, value));
}

/**
 * Build a local Euler rotation (degrees, XYZ order) that rotates the
 * rest direction `from` onto the target direction `to`.
 *
 * For R6 limbs the rest direction is (0, -1, 0) (hanging straight down).
 * We decompose the rotation into pitch (local X) + roll (local Z) — the
 * character's right/left reach and forward/back reach. Twist (local Y)
 * is irrelevant on a rigid cylindrical limb so it stays zero.
 */
export function directionToEuler(from: Vec3, to: Vec3): Vec3 {
  const a = normalise(from);
  const b = normalise(to);
  if (length(a) < 1e-9 || length(b) < 1e-9) {
    return { x: 0, y: 0, z: 0 };
  }
  const restIsUp = a.y > 0.5;
  // JS quirk: Math.atan2(0, -0) === Math.PI, which leaks π into a
  // "no rotation" result whenever b.y is exactly 0 and the result
  // would otherwise be 0. Neutralise -0 before passing to atan2.
  const posY = b.y || 0;
  const negY = -b.y || 0;

  if (restIsUp) {
    const pitchX = Math.atan2(b.z, posY);
    const rollZ = Math.atan2(-b.x, posY);
    return { x: radToDeg(pitchX), y: 0, z: radToDeg(rollZ) };
  }

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
  rotation: Vec3;
  clamped: boolean;
}

/**
 * Transform a world-space target into the torso's local frame. Lets the
 * limb solver work as if the torso were at the origin with identity
 * rotation, matching how R6Model nests joints inside the torso group.
 *
 * report06 #4 — before this, anchorWorld = anchorLocal + torsoRoot
 * ignored torso rotation, so any twisted-torso pose solved against the
 * wrong shoulder/hip positions.
 */
function worldToTorsoLocal(
  target: Vec3,
  torsoRoot: Vec3,
  torsoRotation: Vec3
): Vec3 {
  const t = sub(target, torsoRoot);
  // Undo the torso rotation by rotating with its conjugate.
  const q = conjugateQuaternion(eulerToQuaternion(torsoRotation));
  return rotateVec3(t, q);
}

/**
 * One-bone IK — rotate a limb from its rest direction toward the target.
 * Works in the rig-local frame (torso origin at world zero, torso
 * rotation as identity).
 */
export function solveLimbIK(
  part: R6PartName,
  target: Vec3,
  torsoRoot: Vec3 = { x: 0, y: 0, z: 0 },
  torsoRotation: Vec3 = { x: 0, y: 0, z: 0 }
): LimbSolveResult {
  const anchor = JOINT_ANCHORS[part];
  const reach = LIMB_LENGTHS[part];

  // Move the target into torso-local space so the solver can use
  // `anchor` (torso-local) directly.
  const localTarget = worldToTorsoLocal(target, torsoRoot, torsoRotation);
  const clampedTarget = clampTargetToReach(anchor, localTarget, reach);
  const clamped = clampedTarget !== localTarget;

  const dir = normalise(sub(clampedTarget, anchor));
  const rest = REST_DIRECTION[part];
  const rotation = directionToEuler(rest, dir);
  return { rotation, clamped };
}

/**
 * Face-forward head look. The head's "face direction" is local +Z;
 * solving routes a target through yaw (local Y) + pitch (local X).
 * Clamps to sensible human limits so you can't spin a head 180°.
 *
 * report06 #2 — before this, headLook went through solveLimbIK, which
 * mapped "target to the right" into local Z roll (a sideways head
 * tilt) instead of a Y yaw.
 */
export function solveHeadLook(
  target: Vec3,
  torsoRoot: Vec3 = { x: 0, y: 0, z: 0 },
  torsoRotation: Vec3 = { x: 0, y: 0, z: 0 }
): LimbSolveResult {
  const anchor = JOINT_ANCHORS.head;
  const localTarget = worldToTorsoLocal(target, torsoRoot, torsoRotation);
  const dir = normalise(sub(localTarget, anchor));
  if (length(dir) < 1e-9) {
    return { rotation: { x: 0, y: 0, z: 0 }, clamped: false };
  }
  // yaw around +Y: in Three.js right-handed rotation, head.y = +90°
  // rotates the face direction from +Z to +X (character's right).
  // So for a target in +X we want yaw = +90° → atan2(dir.x, dir.z).
  const yaw = Math.atan2(dir.x, dir.z);
  // pitch around +X: positive pitch tilts face DOWN (consistent with
  // head.x=+25 = chin down from the system prompt).
  const horizontalLength = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
  const pitch = Math.atan2(-dir.y, horizontalLength);

  const yawDeg = clampTo(radToDeg(yaw), 80);
  const pitchDeg = clampTo(radToDeg(pitch), 60);
  const clamped =
    yawDeg !== radToDeg(yaw) || pitchDeg !== radToDeg(pitch);
  return {
    rotation: { x: pitchDeg, y: yawDeg, z: 0 },
    clamped,
  };
}

export interface SolveResult {
  pose: R6Pose;
  clamped: Partial<Record<IKHandleName, boolean>>;
}

/**
 * Solve a full pose from a map of IK targets. Only the handles present
 * in `targets` are touched, so the caller can bake a single hand without
 * overwriting untouched joints (report06 #1).
 */
export function solveIKPose(
  basePose: R6Pose,
  targets: Partial<Record<IKHandleName, Vec3>>
): SolveResult {
  const pose = clonePose(basePose);
  const torsoRoot = pose.torso.position || { x: 0, y: 0, z: 0 };
  const torsoRotation = pose.torso.rotation;
  const clamped: Partial<Record<IKHandleName, boolean>> = {};

  for (const handle of Object.keys(targets) as IKHandleName[]) {
    const target = targets[handle];
    if (!target) continue;

    const result =
      handle === 'headLook'
        ? solveHeadLook(target, torsoRoot, torsoRotation)
        : solveLimbIK(
            IK_HANDLE_TO_PART[handle],
            target,
            torsoRoot,
            torsoRotation
          );

    if (
      !Number.isFinite(result.rotation.x) ||
      !Number.isFinite(result.rotation.y) ||
      !Number.isFinite(result.rotation.z)
    ) {
      continue;
    }
    const part = IK_HANDLE_TO_PART[handle];
    pose[part] = { ...pose[part], rotation: result.rotation };
    if (result.clamped) clamped[handle] = true;
  }
  return { pose, clamped };
}

/**
 * Torso-translation compensation: given a set of pinned targets
 * (feet, hands) and the current rig root, find a root translation that
 * reduces drift between the pinned targets and their reachable limb tips.
 * V1 implementation: average the deltas between each pinned target's
 * neutral anchor-tip and its actual target, and apply as a translation.
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
