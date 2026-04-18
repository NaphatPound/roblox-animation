import type { R6Pose } from '@/types';

export const DEFAULT_POSE: R6Pose = {
  head: { rotation: { x: 0, y: 0, z: 0 } },
  torso: { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
  leftArm: { rotation: { x: 0, y: 0, z: 0 } },
  rightArm: { rotation: { x: 0, y: 0, z: 0 } },
  leftLeg: { rotation: { x: 0, y: 0, z: 0 } },
  rightLeg: { rotation: { x: 0, y: 0, z: 0 } },
};

export function clonePose(pose: R6Pose): R6Pose {
  return {
    head: {
      rotation: { ...pose.head.rotation },
      position: pose.head.position ? { ...pose.head.position } : undefined,
    },
    torso: {
      rotation: { ...pose.torso.rotation },
      position: pose.torso.position ? { ...pose.torso.position } : undefined,
    },
    leftArm: {
      rotation: { ...pose.leftArm.rotation },
      position: pose.leftArm.position ? { ...pose.leftArm.position } : undefined,
    },
    rightArm: {
      rotation: { ...pose.rightArm.rotation },
      position: pose.rightArm.position ? { ...pose.rightArm.position } : undefined,
    },
    leftLeg: {
      rotation: { ...pose.leftLeg.rotation },
      position: pose.leftLeg.position ? { ...pose.leftLeg.position } : undefined,
    },
    rightLeg: {
      rotation: { ...pose.rightLeg.rotation },
      position: pose.rightLeg.position ? { ...pose.rightLeg.position } : undefined,
    },
  };
}
