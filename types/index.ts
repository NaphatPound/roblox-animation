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

export type GizmoMode = 'rotate' | 'translate';

export type EditMode = 'fk' | 'ik';

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

export type AISource = 'cloud' | 'local' | 'fallback';

export interface AIPoseResponse {
  pose: R6Pose;
  confidence?: number;
  description?: string;
}

/**
 * Response contract for /api/ai-text and /api/ai-vision.
 * `source` tells the client which backend produced the pose:
 *  - 'cloud'    — Ollama Cloud call succeeded
 *  - 'local'    — local Ollama daemon call succeeded
 *  - 'fallback' — both backends failed, pose is a keyword heuristic;
 *                 the HTTP status will be non-200 so callers should
 *                 surface `error` rather than auto-import the pose.
 */
export interface AIPoseResult extends AIPoseResponse {
  source: AISource;
  error?: string;
}

export interface AITextAnimationRequest {
  prompt: string;
  duration?: number;
}

export interface AIVisionAnalysisRequest {
  imageBase64: string;
  prompt?: string;
}
