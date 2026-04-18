import {
  clamp,
  degToRad,
  radToDeg,
  lerp,
  lerpVec3,
  applyEasing,
  eulerToQuaternion,
  quaternionToEuler,
  normalizeQuaternion,
  slerp,
  slerpEuler,
  generateId,
} from '../utils/mathUtils';

describe('mathUtils', () => {
  describe('clamp', () => {
    it('returns value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
    it('clamps to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
    it('clamps to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('degToRad / radToDeg', () => {
    it('converts 180deg to Pi', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI, 5);
    });
    it('converts Pi to 180deg', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180, 5);
    });
    it('round-trips 45deg', () => {
      expect(radToDeg(degToRad(45))).toBeCloseTo(45, 5);
    });
  });

  describe('lerp', () => {
    it('returns start when t=0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });
    it('returns end when t=1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });
    it('returns midpoint when t=0.5', () => {
      expect(lerp(10, 20, 0.5)).toBe(15);
    });
    it('clamps t above 1', () => {
      expect(lerp(0, 10, 2)).toBe(10);
    });
    it('clamps t below 0', () => {
      expect(lerp(0, 10, -1)).toBe(0);
    });
  });

  describe('lerpVec3', () => {
    it('interpolates all three axes', () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 10, y: 20, z: 30 };
      const mid = lerpVec3(a, b, 0.5);
      expect(mid).toEqual({ x: 5, y: 10, z: 15 });
    });
  });

  describe('applyEasing', () => {
    it('returns linear value unchanged', () => {
      expect(applyEasing(0.5, 'linear')).toBe(0.5);
    });
    it('easeIn returns squared', () => {
      expect(applyEasing(0.5, 'easeIn')).toBeCloseTo(0.25, 5);
    });
    it('easeOut at 0.5 is 0.75', () => {
      expect(applyEasing(0.5, 'easeOut')).toBeCloseTo(0.75, 5);
    });
    it('easeInOut produces S-curve', () => {
      expect(applyEasing(0.0, 'easeInOut')).toBeCloseTo(0, 5);
      expect(applyEasing(0.5, 'easeInOut')).toBeCloseTo(0.5, 5);
      expect(applyEasing(1.0, 'easeInOut')).toBeCloseTo(1, 5);
    });
  });

  describe('euler <-> quaternion round-trip', () => {
    it('round-trips small angles', () => {
      const euler = { x: 30, y: 20, z: 10 };
      const q = eulerToQuaternion(euler);
      const back = quaternionToEuler(q);
      expect(back.x).toBeCloseTo(30, 4);
      expect(back.y).toBeCloseTo(20, 4);
      expect(back.z).toBeCloseTo(10, 4);
    });

    it('round-trips zero', () => {
      const q = eulerToQuaternion({ x: 0, y: 0, z: 0 });
      expect(q.w).toBeCloseTo(1, 5);
      expect(q.x).toBeCloseTo(0, 5);
    });

    it('produces unit-length quaternion', () => {
      const q = eulerToQuaternion({ x: 45, y: 60, z: 90 });
      const len = Math.sqrt(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2);
      expect(len).toBeCloseTo(1, 5);
    });
  });

  describe('normalizeQuaternion', () => {
    it('returns identity for zero vector', () => {
      const q = normalizeQuaternion({ x: 0, y: 0, z: 0, w: 0 });
      expect(q).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });
    it('normalizes to unit length', () => {
      const q = normalizeQuaternion({ x: 2, y: 0, z: 0, w: 0 });
      expect(q.x).toBeCloseTo(1, 5);
    });
  });

  describe('slerp', () => {
    it('returns start at t=0', () => {
      const q0 = eulerToQuaternion({ x: 0, y: 0, z: 0 });
      const q1 = eulerToQuaternion({ x: 90, y: 0, z: 0 });
      const mid = slerp(q0, q1, 0);
      expect(mid.w).toBeCloseTo(q0.w, 4);
      expect(mid.x).toBeCloseTo(q0.x, 4);
    });

    it('returns end at t=1', () => {
      const q0 = eulerToQuaternion({ x: 0, y: 0, z: 0 });
      const q1 = eulerToQuaternion({ x: 90, y: 0, z: 0 });
      const mid = slerp(q0, q1, 1);
      expect(mid.w).toBeCloseTo(q1.w, 4);
      expect(mid.x).toBeCloseTo(q1.x, 4);
    });

    it('midpoint gives half angle', () => {
      const q0 = eulerToQuaternion({ x: 0, y: 0, z: 0 });
      const q1 = eulerToQuaternion({ x: 90, y: 0, z: 0 });
      const mid = slerp(q0, q1, 0.5);
      const euler = quaternionToEuler(mid);
      expect(euler.x).toBeCloseTo(45, 3);
    });

    it('result is unit-length', () => {
      const q0 = eulerToQuaternion({ x: 0, y: 0, z: 0 });
      const q1 = eulerToQuaternion({ x: 45, y: 60, z: 30 });
      const mid = slerp(q0, q1, 0.37);
      const len = Math.sqrt(mid.x ** 2 + mid.y ** 2 + mid.z ** 2 + mid.w ** 2);
      expect(len).toBeCloseTo(1, 4);
    });
  });

  describe('slerpEuler', () => {
    it('smoothly interpolates euler angles', () => {
      const a = { x: 0, y: 0, z: 0 };
      const b = { x: 60, y: 0, z: 0 };
      const mid = slerpEuler(a, b, 0.5);
      expect(mid.x).toBeCloseTo(30, 3);
    });
  });

  describe('generateId', () => {
    it('returns unique string ids', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateId()));
      expect(ids.size).toBe(50);
    });
  });
});
