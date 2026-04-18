import type { QuaternionData, Vec3, EasingType } from '@/types';

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function degToRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

export function radToDeg(rad: number): number {
  return rad * RAD_TO_DEG;
}

export function lerp(a: number, b: number, t: number): number {
  const clampedT = clamp(t, 0, 1);
  return a + (b - a) * clampedT;
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

export function applyEasing(t: number, easing: EasingType = 'linear'): number {
  const clampedT = clamp(t, 0, 1);
  switch (easing) {
    case 'easeIn':
      return clampedT * clampedT;
    case 'easeOut':
      return 1 - (1 - clampedT) * (1 - clampedT);
    case 'easeInOut':
      return clampedT < 0.5
        ? 2 * clampedT * clampedT
        : 1 - Math.pow(-2 * clampedT + 2, 2) / 2;
    case 'linear':
    default:
      return clampedT;
  }
}

export function eulerToQuaternion(euler: Vec3): QuaternionData {
  const xRad = degToRad(euler.x);
  const yRad = degToRad(euler.y);
  const zRad = degToRad(euler.z);

  const cx = Math.cos(xRad * 0.5);
  const sx = Math.sin(xRad * 0.5);
  const cy = Math.cos(yRad * 0.5);
  const sy = Math.sin(yRad * 0.5);
  const cz = Math.cos(zRad * 0.5);
  const sz = Math.sin(zRad * 0.5);

  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
}

export function quaternionToEuler(q: QuaternionData): Vec3 {
  const sinrCosp = 2 * (q.w * q.x + q.y * q.z);
  const cosrCosp = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const pitch =
    Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);

  const sinyCosp = 2 * (q.w * q.z + q.x * q.y);
  const cosyCosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return {
    x: radToDeg(roll),
    y: radToDeg(pitch),
    z: radToDeg(yaw),
  };
}

export function normalizeQuaternion(q: QuaternionData): QuaternionData {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (len === 0) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

export function slerp(
  q0: QuaternionData,
  q1: QuaternionData,
  t: number
): QuaternionData {
  const clampedT = clamp(t, 0, 1);
  const a = normalizeQuaternion(q0);
  let b = normalizeQuaternion(q1);

  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

  if (dot < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    dot = -dot;
  }

  const DOT_THRESHOLD = 0.9995;
  if (dot > DOT_THRESHOLD) {
    const result = {
      x: a.x + clampedT * (b.x - a.x),
      y: a.y + clampedT * (b.y - a.y),
      z: a.z + clampedT * (b.z - a.z),
      w: a.w + clampedT * (b.w - a.w),
    };
    return normalizeQuaternion(result);
  }

  const theta0 = Math.acos(clamp(dot, -1, 1));
  const theta = theta0 * clampedT;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);

  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return {
    x: a.x * s0 + b.x * s1,
    y: a.y * s0 + b.y * s1,
    z: a.z * s0 + b.z * s1,
    w: a.w * s0 + b.w * s1,
  };
}

export function slerpEuler(a: Vec3, b: Vec3, t: number): Vec3 {
  const qA = eulerToQuaternion(a);
  const qB = eulerToQuaternion(b);
  const qOut = slerp(qA, qB, t);
  return quaternionToEuler(qOut);
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
