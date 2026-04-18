import {
  isValidPose,
  sanitizeClip,
  toAnimationClip,
} from '../lib/animationClip';
import { DEFAULT_POSE, clonePose } from '../store/useAnimationStore';

describe('isValidPose', () => {
  it('accepts a complete R6Pose', () => {
    expect(isValidPose(DEFAULT_POSE)).toBe(true);
  });

  it('rejects null/undefined', () => {
    expect(isValidPose(null)).toBe(false);
    expect(isValidPose(undefined)).toBe(false);
  });

  it('rejects a pose missing a part', () => {
    const partial = { ...clonePose(DEFAULT_POSE) } as Record<string, unknown>;
    delete partial.rightArm;
    expect(isValidPose(partial)).toBe(false);
  });

  it('rejects a pose with non-numeric rotation values', () => {
    const bad = clonePose(DEFAULT_POSE) as unknown as Record<string, { rotation: Record<string, unknown> }>;
    bad.head.rotation = { x: 'foo', y: 0, z: 0 };
    expect(isValidPose(bad)).toBe(false);
  });
});

describe('sanitizeClip', () => {
  const clipJson = {
    name: 'test',
    duration: 60,
    fps: 30,
    keyframes: [
      { id: 'a', frame: 0, pose: DEFAULT_POSE },
      { id: 'b', frame: 30, pose: DEFAULT_POSE },
    ],
  };

  it('accepts a valid clip', () => {
    const out = sanitizeClip(clipJson);
    expect(out).not.toBeNull();
    expect(out!.keyframes).toHaveLength(2);
    expect(out!.name).toBe('test');
  });

  it('returns null for non-object input', () => {
    expect(sanitizeClip(null)).toBeNull();
    expect(sanitizeClip('string')).toBeNull();
    expect(sanitizeClip(42)).toBeNull();
  });

  it('returns null when keyframes is not an array', () => {
    expect(sanitizeClip({ keyframes: 'bad' })).toBeNull();
  });

  it('returns null when no valid keyframes are present', () => {
    expect(sanitizeClip({ keyframes: [{}, { frame: 'x' }] })).toBeNull();
  });

  it('drops invalid entries but keeps valid ones', () => {
    const mixed = {
      keyframes: [
        { frame: 0, pose: DEFAULT_POSE },
        { frame: 'bad', pose: DEFAULT_POSE },
        { frame: 10 },
        { frame: 20, pose: DEFAULT_POSE },
      ],
    };
    const out = sanitizeClip(mixed);
    expect(out).not.toBeNull();
    expect(out!.keyframes.map((k) => k.frame)).toEqual([0, 20]);
  });

  it('sorts keyframes by frame ascending', () => {
    const out = sanitizeClip({
      keyframes: [
        { frame: 30, pose: DEFAULT_POSE },
        { frame: 0, pose: DEFAULT_POSE },
        { frame: 15, pose: DEFAULT_POSE },
      ],
    });
    expect(out!.keyframes.map((k) => k.frame)).toEqual([0, 15, 30]);
  });

  it('falls back to defaults for missing name/duration/fps', () => {
    const out = sanitizeClip({
      keyframes: [{ frame: 0, pose: DEFAULT_POSE }],
    });
    expect(out!.name).toBe('imported');
    expect(out!.duration).toBe(60);
    expect(out!.fps).toBe(30);
  });

  it('floors non-integer frames to integers', () => {
    const out = sanitizeClip({
      keyframes: [{ frame: 12.7, pose: DEFAULT_POSE }],
    });
    expect(out!.keyframes[0].frame).toBe(12);
  });
});

describe('toAnimationClip', () => {
  it('clones keyframe poses so mutations do not leak', () => {
    const kfs = [
      { id: 'a', frame: 0, pose: clonePose(DEFAULT_POSE) },
    ];
    const clip = toAnimationClip(kfs, 60, 30);
    clip.keyframes[0].pose.head.rotation.x = 999;
    expect(kfs[0].pose.head.rotation.x).toBe(0);
  });

  it('passes through duration and fps', () => {
    const clip = toAnimationClip([], 120, 60);
    expect(clip.duration).toBe(120);
    expect(clip.fps).toBe(60);
  });

  it('preserves easing on export (regression: report #3)', () => {
    const kfs = [
      { id: 'a', frame: 0, pose: clonePose(DEFAULT_POSE), easing: 'easeIn' as const },
      { id: 'b', frame: 10, pose: clonePose(DEFAULT_POSE) },
    ];
    const clip = toAnimationClip(kfs, 30, 30);
    expect(clip.keyframes[0].easing).toBe('easeIn');
    expect(clip.keyframes[1].easing).toBeUndefined();
  });
});

describe('easing round-trip (regression: report #3)', () => {
  it('preserves valid easing values through export and import', () => {
    const kfs = [
      { id: 'a', frame: 0, pose: clonePose(DEFAULT_POSE), easing: 'easeInOut' as const },
      { id: 'b', frame: 10, pose: clonePose(DEFAULT_POSE), easing: 'linear' as const },
      { id: 'c', frame: 20, pose: clonePose(DEFAULT_POSE), easing: 'easeOut' as const },
    ];
    const exported = toAnimationClip(kfs, 60, 30);
    const json = JSON.parse(JSON.stringify(exported));
    const reimported = sanitizeClip(json);
    expect(reimported).not.toBeNull();
    expect(reimported!.keyframes.map((k) => k.easing)).toEqual([
      'easeInOut',
      'linear',
      'easeOut',
    ]);
  });

  it('drops unknown easing strings on import rather than passing them through', () => {
    const clip = sanitizeClip({
      keyframes: [
        { frame: 0, pose: DEFAULT_POSE, easing: 'bounce' },
      ],
    });
    expect(clip!.keyframes[0].easing).toBeUndefined();
  });

  it('omits the easing field when it is not set on a keyframe', () => {
    const clip = sanitizeClip({
      keyframes: [{ frame: 0, pose: DEFAULT_POSE }],
    });
    expect('easing' in clip!.keyframes[0]).toBe(false);
  });
});
