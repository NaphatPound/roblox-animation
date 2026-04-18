import { DEFAULT_POSE } from '../lib/pose';
import { POSE_PRESETS } from '../lib/presets';

// Rig constants mirror R6Model's JOINT_POSITIONS / MESH_OFFSETS / PART_SIZES.
// If R6Model changes, these must change with it.
const TORSO_ORIGIN_Y = 0;
const HIP_Y_FROM_TORSO = -1;
const LEG_LENGTH = 2;
const RIG_FOOT_Y = TORSO_ORIGIN_Y + HIP_Y_FROM_TORSO - LEG_LENGTH; // -3
const GROUND_Y = -3; // must match Scene.tsx

describe('ground alignment (regression: report #4)', () => {
  it('DEFAULT_POSE keeps torso at rig origin (y=0) so feet match GROUND_Y', () => {
    const y = DEFAULT_POSE.torso.position?.y ?? 0;
    expect(y).toBe(0);
    expect(RIG_FOOT_Y).toBe(GROUND_Y);
  });

  it('non-torso parts have no baked-in world position (positions come from R6Model joints)', () => {
    expect(DEFAULT_POSE.head.position).toBeUndefined();
    expect(DEFAULT_POSE.leftArm.position).toBeUndefined();
    expect(DEFAULT_POSE.rightArm.position).toBeUndefined();
    expect(DEFAULT_POSE.leftLeg.position).toBeUndefined();
    expect(DEFAULT_POSE.rightLeg.position).toBeUndefined();
  });

  it('jump preset lifts the rig above the ground (intentional float)', () => {
    const pose = POSE_PRESETS.jump();
    const y = pose.torso.position?.y ?? 0;
    expect(y).toBeGreaterThan(0);
    const feetWorldY = RIG_FOOT_Y + y;
    expect(feetWorldY).toBeGreaterThan(GROUND_Y);
  });

  it('crouch preset drops torso so bent legs end near the ground', () => {
    const pose = POSE_PRESETS.crouch();
    const y = pose.torso.position?.y ?? 0;
    expect(y).toBeLessThan(0);
    // With legs rotated x=-90 their mesh spans y=hipY-0.5 to hipY+0.5 (leg width=1).
    const hipY = y + HIP_Y_FROM_TORSO;
    const bentFootY = hipY - 0.5;
    expect(bentFootY).toBeCloseTo(GROUND_Y, 0);
  });

  it('idle preset leaves feet exactly on the ground', () => {
    const pose = POSE_PRESETS.idle();
    const y = pose.torso.position?.y ?? 0;
    const feetWorldY = RIG_FOOT_Y + y;
    expect(feetWorldY).toBe(GROUND_Y);
  });
});
