import type { R6Pose } from '@/types';
import { DEFAULT_POSE, clonePose } from '@/store/useAnimationStore';

function base(): R6Pose {
  return clonePose(DEFAULT_POSE);
}

export const POSE_PRESETS: Record<string, () => R6Pose> = {
  idle: () => base(),

  tpose: () => {
    const p = base();
    p.leftArm.rotation = { x: 0, y: 0, z: -90 };
    p.rightArm.rotation = { x: 0, y: 0, z: 90 };
    return p;
  },

  punchRight: () => {
    const p = base();
    p.rightArm.rotation = { x: -90, y: 0, z: 0 };
    p.torso.rotation = { x: 0, y: -20, z: 0 };
    p.leftArm.rotation = { x: 20, y: 0, z: 0 };
    return p;
  },

  punchLeft: () => {
    const p = base();
    p.leftArm.rotation = { x: -90, y: 0, z: 0 };
    p.torso.rotation = { x: 0, y: 20, z: 0 };
    p.rightArm.rotation = { x: 20, y: 0, z: 0 };
    return p;
  },

  kickRight: () => {
    const p = base();
    p.rightLeg.rotation = { x: -90, y: 0, z: 0 };
    p.torso.rotation = { x: -5, y: 0, z: 0 };
    p.leftArm.rotation = { x: -30, y: 0, z: 20 };
    p.rightArm.rotation = { x: -15, y: 0, z: -10 };
    return p;
  },

  wave: () => {
    const p = base();
    p.rightArm.rotation = { x: 0, y: 0, z: 150 };
    p.head.rotation = { x: 0, y: 10, z: 0 };
    return p;
  },

  runRight: () => {
    const p = base();
    p.leftArm.rotation = { x: 60, y: 0, z: 0 };
    p.rightArm.rotation = { x: -60, y: 0, z: 0 };
    p.leftLeg.rotation = { x: -40, y: 0, z: 0 };
    p.rightLeg.rotation = { x: 40, y: 0, z: 0 };
    p.torso.rotation = { x: 10, y: 0, z: 0 };
    return p;
  },

  runLeft: () => {
    const p = base();
    p.leftArm.rotation = { x: -60, y: 0, z: 0 };
    p.rightArm.rotation = { x: 60, y: 0, z: 0 };
    p.leftLeg.rotation = { x: 40, y: 0, z: 0 };
    p.rightLeg.rotation = { x: -40, y: 0, z: 0 };
    p.torso.rotation = { x: 10, y: 0, z: 0 };
    return p;
  },

  jump: () => {
    const p = base();
    p.leftArm.rotation = { x: -150, y: 0, z: 10 };
    p.rightArm.rotation = { x: -150, y: 0, z: -10 };
    p.leftLeg.rotation = { x: 30, y: 0, z: 0 };
    p.rightLeg.rotation = { x: 30, y: 0, z: 0 };
    p.torso.position = { x: 0, y: 1.5, z: 0 };
    return p;
  },

  crouch: () => {
    const p = base();
    p.leftLeg.rotation = { x: -90, y: 0, z: 0 };
    p.rightLeg.rotation = { x: -90, y: 0, z: 0 };
    p.leftArm.rotation = { x: -30, y: 0, z: 15 };
    p.rightArm.rotation = { x: -30, y: 0, z: -15 };
    p.torso.position = { x: 0, y: -1, z: 0 };
    return p;
  },
};

export const PRESET_ORDER: { key: string; label: string }[] = [
  { key: 'idle', label: 'Idle' },
  { key: 'tpose', label: 'T-Pose' },
  { key: 'wave', label: 'Wave' },
  { key: 'punchRight', label: 'Punch R' },
  { key: 'punchLeft', label: 'Punch L' },
  { key: 'kickRight', label: 'Kick R' },
  { key: 'runRight', label: 'Run R' },
  { key: 'runLeft', label: 'Run L' },
  { key: 'jump', label: 'Jump' },
  { key: 'crouch', label: 'Crouch' },
];
