import {
  compensateTorso,
  directionToEuler,
  solveHeadLook,
  solveIKPose,
  solveLimbIK,
} from '../lib/rig/r6IkSolver';
import { JOINT_ANCHORS } from '../lib/rig/r6Rig';
import { DEFAULT_POSE, clonePose } from '../lib/pose';

describe('directionToEuler', () => {
  it('returns zero for rest direction (limb hanging straight down)', () => {
    const r = directionToEuler({ x: 0, y: -1, z: 0 }, { x: 0, y: -1, z: 0 });
    expect(r.x).toBeCloseTo(0, 4);
    expect(r.z).toBeCloseTo(0, 4);
  });

  it('returns approximately -90° around X when rotating down → forward', () => {
    // (0,-1,0) → (0,0,1): rotate -90° around X.
    const r = directionToEuler({ x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 });
    expect(r.x).toBeCloseTo(-90, 1);
  });

  it('returns +90° around Z when rotating down → character-right', () => {
    // (0,-1,0) → (+1,0,0): rotate +90° around Z.
    const r = directionToEuler({ x: 0, y: -1, z: 0 }, { x: 1, y: 0, z: 0 });
    expect(r.z).toBeCloseTo(90, 1);
  });

  it('never returns NaN / Infinity', () => {
    const cases = [
      [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
    ] as const;
    for (const [from, to] of cases) {
      const r = directionToEuler(from, to);
      expect(Number.isFinite(r.x)).toBe(true);
      expect(Number.isFinite(r.y)).toBe(true);
      expect(Number.isFinite(r.z)).toBe(true);
    }
  });
});

describe('solveLimbIK (one-bone R6)', () => {
  it('right arm pointing forward swings with x ~ -90', () => {
    // Target in front of the right shoulder, one arm-length away.
    const anchor = JOINT_ANCHORS.rightArm;
    const target = { x: anchor.x, y: anchor.y, z: anchor.z + 2 };
    const { rotation, clamped } = solveLimbIK('rightArm', target);
    expect(clamped).toBe(false);
    expect(rotation.x).toBeCloseTo(-90, 1);
    expect(rotation.z).toBeCloseTo(0, 1);
  });

  it('right arm reaching to character-right swings with z ~ +90', () => {
    const anchor = JOINT_ANCHORS.rightArm;
    const target = { x: anchor.x + 2, y: anchor.y, z: anchor.z };
    const { rotation } = solveLimbIK('rightArm', target);
    expect(rotation.z).toBeCloseTo(90, 1);
  });

  it('clamps an unreachable target to the limb length', () => {
    const anchor = JOINT_ANCHORS.rightArm;
    // 10 studs away — arms are only 2 long.
    const target = { x: anchor.x + 10, y: anchor.y, z: anchor.z };
    const { rotation, clamped } = solveLimbIK('rightArm', target);
    expect(clamped).toBe(true);
    // Still valid numbers, still roughly pointing +X.
    expect(rotation.z).toBeCloseTo(90, 1);
    expect(Number.isFinite(rotation.x)).toBe(true);
  });

  it('solver never returns NaN rotations even for degenerate targets', () => {
    const degenerate = [
      { x: 0, y: 0, z: 0 }, // coincident with rig root
      JOINT_ANCHORS.rightArm, // coincident with the anchor itself
    ];
    for (const t of degenerate) {
      const { rotation } = solveLimbIK('rightArm', t);
      expect(Number.isFinite(rotation.x)).toBe(true);
      expect(Number.isFinite(rotation.y)).toBe(true);
      expect(Number.isFinite(rotation.z)).toBe(true);
    }
  });
});

describe('solveIKPose (full-pose solve)', () => {
  it('only touches the parts whose handles were provided', () => {
    const base = clonePose(DEFAULT_POSE);
    base.leftArm.rotation = { x: 45, y: 0, z: 0 };
    const { pose } = solveIKPose(base, {
      rightHand: {
        x: JOINT_ANCHORS.rightArm.x + 2,
        y: JOINT_ANCHORS.rightArm.y,
        z: JOINT_ANCHORS.rightArm.z,
      },
    });
    // Left arm untouched.
    expect(pose.leftArm.rotation.x).toBe(45);
    // Right arm solved outward.
    expect(pose.rightArm.rotation.z).toBeCloseTo(90, 1);
  });

  it('reports clamped handles when targets are out of reach', () => {
    const { clamped } = solveIKPose(DEFAULT_POSE, {
      rightHand: { x: 50, y: 0, z: 0 },
    });
    expect(clamped.rightHand).toBe(true);
  });
});

describe('solveHeadLook (report06 #2 — yaw/pitch, not limb roll)', () => {
  it('target to the character-right yields positive y yaw, zero z roll', () => {
    const anchor = JOINT_ANCHORS.head;
    const target = { x: anchor.x + 5, y: anchor.y, z: anchor.z };
    const { rotation } = solveHeadLook(target);
    expect(rotation.y).toBeGreaterThan(0);
    expect(rotation.z).toBeCloseTo(0, 3);
  });

  it('target to the character-left yields negative y yaw', () => {
    const anchor = JOINT_ANCHORS.head;
    const target = { x: anchor.x - 5, y: anchor.y, z: anchor.z };
    const { rotation } = solveHeadLook(target);
    expect(rotation.y).toBeLessThan(0);
  });

  it('target below the head yields positive x pitch (chin-down)', () => {
    const anchor = JOINT_ANCHORS.head;
    const target = { x: anchor.x, y: anchor.y - 5, z: anchor.z + 1 };
    const { rotation } = solveHeadLook(target);
    expect(rotation.x).toBeGreaterThan(0);
  });

  it('clamps to sensible human limits (≤ 80° yaw, ≤ 60° pitch)', () => {
    const anchor = JOINT_ANCHORS.head;
    // Directly behind the head — would require 180° yaw without clamp.
    const target = { x: anchor.x, y: anchor.y, z: anchor.z - 5 };
    const { rotation, clamped } = solveHeadLook(target);
    expect(Math.abs(rotation.y)).toBeLessThanOrEqual(80);
    expect(clamped).toBe(true);
  });
});

describe('solveLimbIK with torso rotation (report06 #4)', () => {
  it('respects torso yaw when locating the shoulder', () => {
    // Rotate torso 90° around Y (facing character-right instead of +Z).
    const torsoRotation = { x: 0, y: 90, z: 0 };
    const torsoRoot = { x: 0, y: 0, z: 0 };
    // A target that is FORWARD relative to the rotated torso is +X in world.
    // World-space target directly in front of the rotated shoulder.
    const worldTarget = { x: 2, y: JOINT_ANCHORS.rightArm.y, z: 0 };
    const { rotation } = solveLimbIK(
      'rightArm',
      worldTarget,
      torsoRoot,
      torsoRotation
    );
    // In the torso-local frame, this target is forward (+Z local), so
    // the arm should pitch forward (x ≈ -90), regardless of the world
    // rotation.
    expect(rotation.x).toBeCloseTo(-90, 1);
  });
});

describe('compensateTorso', () => {
  it('returns zero translation when no targets are pinned', () => {
    const root = compensateTorso({ x: 0, y: 0, z: 0 }, {});
    expect(root).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('pushes the root toward pinned targets (average of deltas)', () => {
    // Pin the right foot 1 stud forward and 1 stud down from its neutral position.
    const neutralRightFoot = {
      x: JOINT_ANCHORS.rightLeg.x,
      y: JOINT_ANCHORS.rightLeg.y - 2,
      z: JOINT_ANCHORS.rightLeg.z,
    };
    const target = {
      x: neutralRightFoot.x,
      y: neutralRightFoot.y - 1,
      z: neutralRightFoot.z + 1,
    };
    const root = compensateTorso({ x: 0, y: 0, z: 0 }, { rightFoot: target });
    expect(root.y).toBeCloseTo(-1, 3);
    expect(root.z).toBeCloseTo(1, 3);
  });
});
