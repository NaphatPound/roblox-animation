import type { AnimationClip, EasingType, Keyframe, R6Pose } from '@/types';
import { clonePose } from '@/lib/pose';

const VALID_EASINGS: EasingType[] = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

function parseEasing(value: unknown): EasingType | undefined {
  if (typeof value !== 'string') return undefined;
  return (VALID_EASINGS as string[]).includes(value)
    ? (value as EasingType)
    : undefined;
}

export function isValidPose(p: unknown): p is R6Pose {
  if (!p || typeof p !== 'object') return false;
  const parts = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
  const obj = p as Record<string, unknown>;
  return parts.every((part) => {
    const val = obj[part] as Record<string, unknown> | undefined;
    if (!val || typeof val !== 'object') return false;
    const rot = val.rotation as Record<string, unknown> | undefined;
    return (
      !!rot &&
      typeof rot.x === 'number' &&
      typeof rot.y === 'number' &&
      typeof rot.z === 'number'
    );
  });
}

export function sanitizeClip(raw: unknown): AnimationClip | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.keyframes)) return null;

  const kfs: Keyframe[] = [];
  for (let i = 0; i < obj.keyframes.length; i++) {
    const item = obj.keyframes[i] as Record<string, unknown> | null;
    if (!item || typeof item.frame !== 'number') continue;
    if (!Number.isFinite(item.frame)) continue;
    if (!isValidPose(item.pose)) continue;
    const easing = parseEasing(item.easing);
    const kf: Keyframe = {
      id: typeof item.id === 'string' ? item.id : `imported-${i}`,
      frame: Math.max(0, Math.floor(item.frame)),
      pose: clonePose(item.pose),
    };
    if (easing) kf.easing = easing;
    kfs.push(kf);
  }

  if (kfs.length === 0) return null;

  return {
    name: typeof obj.name === 'string' ? obj.name : 'imported',
    duration: typeof obj.duration === 'number' && obj.duration > 0 ? Math.floor(obj.duration) : 60,
    fps: typeof obj.fps === 'number' && obj.fps > 0 ? Math.floor(obj.fps) : 30,
    keyframes: kfs.sort((a, b) => a.frame - b.frame),
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
