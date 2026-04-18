import {
  findBracketingKeyframes,
  interpolatePose,
  advanceFrame,
} from '../components/3d/InterpolationEngine';
import { DEFAULT_POSE, clonePose } from '../store/useAnimationStore';
import type { Keyframe, R6Pose } from '../types';

function makePoseWithRightArmX(x: number): R6Pose {
  const p = clonePose(DEFAULT_POSE);
  p.rightArm.rotation.x = x;
  return p;
}

describe('findBracketingKeyframes', () => {
  const kf: Keyframe[] = [
    { id: 'a', frame: 0, pose: makePoseWithRightArmX(0) },
    { id: 'b', frame: 10, pose: makePoseWithRightArmX(45) },
    { id: 'c', frame: 30, pose: makePoseWithRightArmX(90) },
  ];

  it('finds surrounding keyframes in the middle', () => {
    const { before, after } = findBracketingKeyframes(kf, 15);
    expect(before!.id).toBe('b');
    expect(after!.id).toBe('c');
  });

  it('returns same keyframe if exact match', () => {
    const { before, after } = findBracketingKeyframes(kf, 10);
    expect(before!.id).toBe('b');
    expect(after!.id).toBe('b');
  });

  it('clamps before first keyframe', () => {
    const { before, after } = findBracketingKeyframes(kf, -5);
    expect(before!.id).toBe('a');
    expect(after!.id).toBe('a');
  });

  it('clamps after last keyframe', () => {
    const { before, after } = findBracketingKeyframes(kf, 1000);
    expect(before!.id).toBe('c');
    expect(after!.id).toBe('c');
  });

  it('returns null when empty', () => {
    const { before, after } = findBracketingKeyframes([], 5);
    expect(before).toBeNull();
    expect(after).toBeNull();
  });
});

describe('interpolatePose', () => {
  it('returns DEFAULT_POSE clone when no keyframes', () => {
    const pose = interpolatePose([], 5);
    expect(pose.head.rotation).toEqual(DEFAULT_POSE.head.rotation);
  });

  it('returns exact pose when frame matches a keyframe', () => {
    const kf: Keyframe[] = [
      { id: 'a', frame: 0, pose: makePoseWithRightArmX(0) },
      { id: 'b', frame: 10, pose: makePoseWithRightArmX(90) },
    ];
    const pose = interpolatePose(kf, 10);
    expect(pose.rightArm.rotation.x).toBeCloseTo(90, 3);
  });

  it('interpolates between two keyframes', () => {
    const kf: Keyframe[] = [
      { id: 'a', frame: 0, pose: makePoseWithRightArmX(0) },
      { id: 'b', frame: 10, pose: makePoseWithRightArmX(90) },
    ];
    const pose = interpolatePose(kf, 5);
    expect(pose.rightArm.rotation.x).toBeGreaterThan(30);
    expect(pose.rightArm.rotation.x).toBeLessThan(60);
  });

  it('handles single keyframe', () => {
    const kf: Keyframe[] = [
      { id: 'a', frame: 0, pose: makePoseWithRightArmX(45) },
    ];
    const pose = interpolatePose(kf, 100);
    expect(pose.rightArm.rotation.x).toBeCloseTo(45, 3);
  });

  it('returns clones (does not mutate source)', () => {
    const kf: Keyframe[] = [
      { id: 'a', frame: 0, pose: makePoseWithRightArmX(0) },
      { id: 'b', frame: 10, pose: makePoseWithRightArmX(90) },
    ];
    const pose = interpolatePose(kf, 5);
    pose.rightArm.rotation.x = 999;
    expect(kf[0].pose.rightArm.rotation.x).toBe(0);
    expect(kf[1].pose.rightArm.rotation.x).toBe(90);
  });
});

describe('advanceFrame', () => {
  it('advances by delta * speed', () => {
    const { frame } = advanceFrame(0, 60, 1, true, 10);
    expect(frame).toBe(10);
  });

  it('loops when reaching end', () => {
    const { frame, reachedEnd } = advanceFrame(55, 60, 1, true, 10);
    expect(reachedEnd).toBe(true);
    expect(frame).toBeLessThan(60);
  });

  it('stops at end when loop is off', () => {
    const { frame, reachedEnd } = advanceFrame(55, 60, 1, false, 10);
    expect(reachedEnd).toBe(true);
    expect(frame).toBe(60);
  });

  it('applies speed multiplier', () => {
    const { frame } = advanceFrame(0, 100, 2, true, 5);
    expect(frame).toBe(10);
  });

  it('clamps negative frames to 0', () => {
    const { frame } = advanceFrame(2, 60, 1, false, -10);
    expect(frame).toBe(0);
  });

  it('scales delta by an arbitrary fps (regression: previously hardcoded 30)', () => {
    const deltaSeconds = 0.5;
    const fps60 = advanceFrame(0, 1000, 1, false, deltaSeconds * 60);
    const fps24 = advanceFrame(0, 1000, 1, false, deltaSeconds * 24);
    expect(fps60.frame).toBe(30);
    expect(fps24.frame).toBe(12);
  });
});
