import { mirrorPose } from '../lib/rig/mirrorPose';
import { DEFAULT_POSE, clonePose } from '../lib/pose';

describe('mirrorPose', () => {
  it('swaps leftArm and rightArm rotations', () => {
    const p = clonePose(DEFAULT_POSE);
    p.rightArm.rotation = { x: -90, y: 0, z: 0 }; // right hook
    const m = mirrorPose(p);
    expect(m.leftArm.rotation).toEqual({ x: -90, y: 0, z: 0 });
    expect(m.rightArm.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('swaps leftLeg and rightLeg rotations', () => {
    const p = clonePose(DEFAULT_POSE);
    p.rightLeg.rotation = { x: -90, y: 0, z: 0 }; // right kick
    const m = mirrorPose(p);
    expect(m.leftLeg.rotation).toEqual({ x: -90, y: 0, z: 0 });
    expect(m.rightLeg.rotation).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('flips yaw (y) and roll (z) on head and torso', () => {
    const p = clonePose(DEFAULT_POSE);
    p.head.rotation = { x: 0, y: 45, z: 10 };
    p.torso.rotation = { x: 0, y: 20, z: 0 };
    const m = mirrorPose(p);
    expect(m.head.rotation).toEqual({ x: 0, y: -45, z: -10 });
    expect(m.torso.rotation).toEqual({ x: 0, y: -20, z: 0 });
  });

  it('preserves forward pitch (x) unchanged', () => {
    const p = clonePose(DEFAULT_POSE);
    p.torso.rotation = { x: 30, y: 0, z: 0 }; // bending forward
    const m = mirrorPose(p);
    expect(m.torso.rotation.x).toBe(30);
  });

  it('swaps X sign on positions when present', () => {
    const p = clonePose(DEFAULT_POSE);
    p.rightArm.position = { x: 2, y: 0, z: 0 };
    const m = mirrorPose(p);
    expect(m.leftArm.position).toEqual({ x: -2, y: 0, z: 0 });
  });

  it('round-trips back to the original pose (idempotent under double-mirror)', () => {
    const p = clonePose(DEFAULT_POSE);
    p.rightArm.rotation = { x: -90, y: 0, z: 20 };
    p.head.rotation = { x: 0, y: 45, z: -5 };
    const m = mirrorPose(mirrorPose(p));
    expect(m.rightArm.rotation).toEqual({ x: -90, y: 0, z: 20 });
    expect(m.head.rotation).toEqual({ x: 0, y: 45, z: -5 });
  });
});
