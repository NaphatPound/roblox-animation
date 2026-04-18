import type { Keyframe, R6Pose, R6PartName, Vec3 } from '@/types';
import { slerpEuler, lerpVec3, applyEasing } from '@/utils/mathUtils';
import { DEFAULT_POSE, clonePose } from '@/lib/pose';

const PART_NAMES: R6PartName[] = [
  'head',
  'torso',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
];

export function findBracketingKeyframes(
  keyframes: Keyframe[],
  frame: number
): { before: Keyframe | null; after: Keyframe | null } {
  if (keyframes.length === 0) {
    return { before: null, after: null };
  }
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  let before: Keyframe | null = null;
  let after: Keyframe | null = null;

  for (const kf of sorted) {
    if (kf.frame <= frame) {
      before = kf;
    }
    if (kf.frame >= frame && !after) {
      after = kf;
    }
  }

  if (!before) before = sorted[0];
  if (!after) after = sorted[sorted.length - 1];

  return { before, after };
}

export function interpolatePose(
  keyframes: Keyframe[],
  frame: number
): R6Pose {
  if (keyframes.length === 0) {
    return clonePose(DEFAULT_POSE);
  }

  const { before, after } = findBracketingKeyframes(keyframes, frame);

  if (!before && !after) return clonePose(DEFAULT_POSE);
  if (!before) return clonePose(after!.pose);
  if (!after) return clonePose(before.pose);
  if (before.frame === after.frame) return clonePose(before.pose);

  const span = after.frame - before.frame;
  const rawT = span === 0 ? 0 : (frame - before.frame) / span;
  const easing = after.easing || 'linear';
  const t = applyEasing(rawT, easing);

  const result: R6Pose = clonePose(before.pose);

  for (const name of PART_NAMES) {
    const from = before.pose[name];
    const to = after.pose[name];

    const rotation: Vec3 = slerpEuler(from.rotation, to.rotation, t);

    let position: Vec3 | undefined;
    if (from.position && to.position) {
      position = lerpVec3(from.position, to.position, t);
    } else {
      position = from.position || to.position;
    }

    result[name] = {
      rotation,
      position: position ? { ...position } : undefined,
    };
  }

  return result;
}

export function advanceFrame(
  currentFrame: number,
  totalFrames: number,
  speed: number,
  loop: boolean,
  deltaFrames: number = 1
): { frame: number; reachedEnd: boolean } {
  const next = currentFrame + deltaFrames * speed;
  if (next >= totalFrames) {
    if (loop) {
      return { frame: next % totalFrames, reachedEnd: true };
    }
    return { frame: totalFrames, reachedEnd: true };
  }
  if (next < 0) {
    return { frame: 0, reachedEnd: false };
  }
  return { frame: next, reachedEnd: false };
}
