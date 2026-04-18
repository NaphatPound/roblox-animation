import type { R6PartName, Vec3 } from '@/types';

// These MUST stay in sync with components/3d/R6Model.tsx constants.
// Joint (pivot) positions in rig-local space (torso origin = (0,0,0)).
export const JOINT_ANCHORS: Record<R6PartName, Vec3> = {
  torso: { x: 0, y: 0, z: 0 },
  head: { x: 0, y: 1.0, z: 0 },
  leftArm: { x: -1.5, y: 1.0, z: 0 },
  rightArm: { x: 1.5, y: 1.0, z: 0 },
  leftLeg: { x: -0.5, y: -1.0, z: 0 },
  rightLeg: { x: 0.5, y: -1.0, z: 0 },
};

// Each limb/head is a single rigid segment. "Length" is the distance
// from the joint anchor to the end effector (hand / foot / top-of-head).
// Arms hang 2 studs below the shoulder; legs hang 2 studs below the hip.
export const LIMB_LENGTHS: Record<R6PartName, number> = {
  torso: 0,
  head: 1.2, // distance from neck to top of head
  leftArm: 2,
  rightArm: 2,
  leftLeg: 2,
  rightLeg: 2,
};

// In neutral pose, every limb hangs straight down (arm tips at y = anchor - 2).
// For the head the "effector" is above the neck so rest dir is +Y.
export const REST_DIRECTION: Record<R6PartName, Vec3> = {
  torso: { x: 0, y: 0, z: 0 },
  head: { x: 0, y: 1, z: 0 },
  leftArm: { x: 0, y: -1, z: 0 },
  rightArm: { x: 0, y: -1, z: 0 },
  leftLeg: { x: 0, y: -1, z: 0 },
  rightLeg: { x: 0, y: -1, z: 0 },
};

export type IKHandleName =
  | 'leftHand'
  | 'rightHand'
  | 'leftFoot'
  | 'rightFoot'
  | 'headLook';

export const IK_HANDLE_TO_PART: Record<IKHandleName, R6PartName> = {
  leftHand: 'leftArm',
  rightHand: 'rightArm',
  leftFoot: 'leftLeg',
  rightFoot: 'rightLeg',
  headLook: 'head',
};

export const IK_HANDLES: IKHandleName[] = [
  'leftHand',
  'rightHand',
  'leftFoot',
  'rightFoot',
  'headLook',
];

/**
 * Default target positions — the effector location of each limb in
 * the neutral (all-zero) pose. Used to reset IK or to seed fresh
 * targets when the user opens IK mode for the first time.
 */
export function defaultIKTargets(torsoRoot: Vec3 = { x: 0, y: 0, z: 0 }): Record<IKHandleName, Vec3> {
  const anchor = (name: R6PartName): Vec3 => ({
    x: torsoRoot.x + JOINT_ANCHORS[name].x,
    y: torsoRoot.y + JOINT_ANCHORS[name].y,
    z: torsoRoot.z + JOINT_ANCHORS[name].z,
  });
  const tip = (name: R6PartName): Vec3 => {
    const a = anchor(name);
    const rest = REST_DIRECTION[name];
    const len = LIMB_LENGTHS[name];
    return {
      x: a.x + rest.x * len,
      y: a.y + rest.y * len,
      z: a.z + rest.z * len,
    };
  };
  return {
    leftHand: tip('leftArm'),
    rightHand: tip('rightArm'),
    leftFoot: tip('leftLeg'),
    rightFoot: tip('rightLeg'),
    headLook: (() => {
      // A point 5 studs in front of the head at neutral neck height.
      const a = anchor('head');
      return { x: a.x, y: a.y + 0.6, z: a.z + 5 };
    })(),
  };
}
