import type { AnimationClip, EasingType, Keyframe, R6Pose, Vec3 } from '@/types';
import { clonePose } from '@/lib/pose';

const VALID_EASINGS: EasingType[] = ['linear', 'easeIn', 'easeOut', 'easeInOut'];
const PART_NAMES = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;

function parseEasing(value: unknown): EasingType | undefined {
  if (typeof value !== 'string') return undefined;
  return (VALID_EASINGS as string[]).includes(value)
    ? (value as EasingType)
    : undefined;
}

export function isValidVec3(v: unknown): v is Vec3 {
  if (!v || typeof v !== 'object') return false;
  const { x, y, z } = v as Record<string, unknown>;
  return (
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof z === 'number' &&
    Number.isFinite(z)
  );
}

export function isValidPose(p: unknown): p is R6Pose {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return PART_NAMES.every((part) => {
    const val = obj[part] as Record<string, unknown> | undefined;
    if (!val || typeof val !== 'object') return false;
    const rot = val.rotation as Record<string, unknown> | undefined;
    if (
      !rot ||
      typeof rot.x !== 'number' ||
      typeof rot.y !== 'number' ||
      typeof rot.z !== 'number'
    ) {
      return false;
    }
    // position is optional, but if present it MUST be a finite Vec3.
    if ('position' in val && val.position !== undefined) {
      if (!isValidVec3(val.position)) return false;
    }
    return true;
  });
}

export function sanitizeClip(raw: unknown): AnimationClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.keyframes)) return null;

  // Collect by frame so duplicates collapse. Later entries win — matches
  // the interactive `addKeyframe` behaviour of "replace at the same frame".
  const byFrame = new Map<number, Keyframe>();
  for (let i = 0; i < obj.keyframes.length; i++) {
    const item = obj.keyframes[i] as Record<string, unknown> | null;
    if (!item || typeof item.frame !== 'number') continue;
    if (!Number.isFinite(item.frame)) continue;
    if (!isValidPose(item.pose)) continue;
    const easing = parseEasing(item.easing);
    const frame = Math.max(0, Math.floor(item.frame));
    const kf: Keyframe = {
      id: typeof item.id === 'string' ? item.id : `imported-${i}`,
      frame,
      pose: clonePose(item.pose),
    };
    if (easing) kf.easing = easing;
    byFrame.set(frame, kf);
  }

  if (byFrame.size === 0) return null;

  const kfs = Array.from(byFrame.values()).sort((a, b) => a.frame - b.frame);

  return {
    name: typeof obj.name === 'string' ? obj.name : 'imported',
    duration: typeof obj.duration === 'number' && obj.duration > 0 ? Math.floor(obj.duration) : 60,
    fps: typeof obj.fps === 'number' && obj.fps > 0 ? Math.floor(obj.fps) : 30,
    keyframes: kfs,
  };
}

export function toAnimationClip(
  keyframes: Keyframe[],
  totalFrames: number,
  fps: number,
  name = 'r6-animation'
): AnimationClip {
  return {
    name,
    duration: totalFrames,
    fps,
    keyframes: keyframes.map((k) => {
      const out: Keyframe = {
        id: k.id,
        frame: k.frame,
        pose: clonePose(k.pose),
      };
      if (k.easing) out.easing = k.easing;
      return out;
    }),
  };
}
