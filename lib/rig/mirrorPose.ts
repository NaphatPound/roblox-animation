import type { R6Pose, Vec3 } from '@/types';
import { clonePose } from '@/lib/pose';

// Avoid introducing `-0` when flipping zeros; -0 !== 0 under Object.is
// (and Jest's .toEqual), which would leak into keyframe comparisons.
function flip(n: number): number {
  return n === 0 ? 0 : -n;
}

function mirrorVec3(v: Vec3 | undefined): Vec3 | undefined {
  if (!v) return v;
  return { x: flip(v.x), y: v.y, z: v.z };
}

/**
 * Mirror a rotation across the rig's sagittal plane (left/right flip).
 *
 * Starting from our convention (x = pitch forward, y = yaw toward
 * character's right, z = roll toward character's right), a mirror
 * swaps the sign of y (the yaw direction flips) and z (the roll
 * direction flips). x (forward/backward) stays the same.
 */
function mirrorRotation(r: Vec3): Vec3 {
  return { x: r.x, y: flip(r.y), z: flip(r.z) };
}

/**
 * Produce a left/right mirrored copy of a pose:
 *   - leftArm  ↔ rightArm
 *   - leftLeg  ↔ rightLeg
 *   - head/torso: sign-flip yaw + roll
 *   - torso position: mirror X
 *
 * Useful for quickly authoring symmetric combat stances ("I just did a
 * right hook, mirror it for the left hook").
 */
export function mirrorPose(pose: R6Pose): R6Pose {
  const out = clonePose(pose);
  // Swap left/right arms.
  const la = pose.leftArm;
  const ra = pose.rightArm;
  out.leftArm = {
    rotation: mirrorRotation(ra.rotation),
    position: mirrorVec3(ra.position),
  };
  out.rightArm = {
    rotation: mirrorRotation(la.rotation),
    position: mirrorVec3(la.position),
  };
  // Swap left/right legs.
  const ll = pose.leftLeg;
  const rl = pose.rightLeg;
  out.leftLeg = {
    rotation: mirrorRotation(rl.rotation),
    position: mirrorVec3(rl.position),
  };
  out.rightLeg = {
    rotation: mirrorRotation(ll.rotation),
    position: mirrorVec3(ll.position),
  };
  // Head and torso stay in place but flip yaw + roll.
  out.head = {
    rotation: mirrorRotation(pose.head.rotation),
    position: mirrorVec3(pose.head.position),
  };
  out.torso = {
    rotation: mirrorRotation(pose.torso.rotation),
    position: mirrorVec3(pose.torso.position),
  };
  return out;
}
