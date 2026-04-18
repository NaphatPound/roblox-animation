export type R6PartName =
  | 'head'
  | 'torso'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionData {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface PartTransform {
  rotation: Vec3;
  position?: Vec3;
}

export interface R6Pose {
  head: PartTransform;
  torso: PartTransform;
  leftArm: PartTransform;
  rightArm: PartTransform;
  leftLeg: PartTransform;
  rightLeg: PartTransform;
}

export interface Keyframe {
  id: string;
  frame: number;
  pose: R6Pose;
  easing?: EasingType;
}

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface AnimationClip {
  name: string;
  duration: number;
  fps: number;
  keyframes: Keyframe[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentFrame: number;
  loop: boolean;
  speed: number;
}

export interface AIPoseResponse {
  pose: R6Pose;
  confidence?: number;
  description?: string;
}

export interface AITextAnimationRequest {
  prompt: string;
  duration?: number;
}

export interface AIVisionAnalysisRequest {
  imageBase64: string;
  prompt?: string;
}
