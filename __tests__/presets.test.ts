import { POSE_PRESETS, PRESET_ORDER } from '../lib/presets';
import { isValidPose } from '../lib/animationClip';

describe('POSE_PRESETS', () => {
  it('every preset in PRESET_ORDER has a factory', () => {
    for (const { key } of PRESET_ORDER) {
      expect(typeof POSE_PRESETS[key]).toBe('function');
    }
  });

  it('each preset produces a valid R6 pose', () => {
    for (const key of Object.keys(POSE_PRESETS)) {
      const pose = POSE_PRESETS[key]();
      expect(isValidPose(pose)).toBe(true);
    }
  });

  it('punchRight sets right arm rotation', () => {
    const pose = POSE_PRESETS.punchRight();
    expect(pose.rightArm.rotation.x).not.toBe(0);
  });

  it('tpose spreads arms outward (left -Z, right +Z) so they do not cross the torso', () => {
    const pose = POSE_PRESETS.tpose();
    expect(pose.leftArm.rotation.z).toBe(-90);
    expect(pose.rightArm.rotation.z).toBe(90);
  });

  it('two separate invocations return independent objects', () => {
    const a = POSE_PRESETS.idle();
    const b = POSE_PRESETS.idle();
    a.head.rotation.x = 123;
    expect(b.head.rotation.x).toBe(0);
  });
});
