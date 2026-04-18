import type { R6Pose, AIPoseResponse } from '@/types';
import { DEFAULT_POSE } from '@/store/useAnimationStore';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'llama3.2';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma3';

const SYSTEM_PROMPT = `You are a Roblox R6 character animation expert. You convert human descriptions or images of poses into joint rotations for a 6-part rig (head, torso, leftArm, rightArm, leftLeg, rightLeg).

Rules:
- Output ONLY raw JSON (no markdown, no commentary).
- Rotations are in Euler degrees on x,y,z axes.
- Valid range: -180 to 180.
- Positive x = pitch forward, positive y = yaw right, positive z = roll right.
- Schema: {"head":{"rotation":{"x":0,"y":0,"z":0}}, "torso":{...}, "leftArm":{...}, "rightArm":{...}, "leftLeg":{...}, "rightLeg":{...}}`;

export interface OllamaPoseResult {
  pose: R6Pose;
  raw: string;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const objectStart = candidate.indexOf('{');
  const objectEnd = candidate.lastIndexOf('}');
  if (objectStart === -1 || objectEnd === -1) {
    throw new Error('No JSON object found in AI response');
  }
  const jsonStr = candidate.slice(objectStart, objectEnd + 1);
  return JSON.parse(jsonStr);
}

export function normalizePose(data: unknown): R6Pose {
  const parts: (keyof R6Pose)[] = [
    'head',
    'torso',
    'leftArm',
    'rightArm',
    'leftLeg',
    'rightLeg',
  ];
  const obj = (data ?? {}) as Record<string, unknown>;
  const result: R6Pose = {
    head: { ...DEFAULT_POSE.head, rotation: { ...DEFAULT_POSE.head.rotation } },
    torso: { ...DEFAULT_POSE.torso, rotation: { ...DEFAULT_POSE.torso.rotation } },
    leftArm: { ...DEFAULT_POSE.leftArm, rotation: { ...DEFAULT_POSE.leftArm.rotation } },
    rightArm: { ...DEFAULT_POSE.rightArm, rotation: { ...DEFAULT_POSE.rightArm.rotation } },
    leftLeg: { ...DEFAULT_POSE.leftLeg, rotation: { ...DEFAULT_POSE.leftLeg.rotation } },
    rightLeg: { ...DEFAULT_POSE.rightLeg, rotation: { ...DEFAULT_POSE.rightLeg.rotation } },
  };

  for (const name of parts) {
    const raw = obj[name] as Record<string, unknown> | undefined;
    if (raw && typeof raw === 'object' && raw.rotation) {
      const rot = raw.rotation as Record<string, unknown>;
      result[name] = {
        ...result[name],
        rotation: {
          x: clampDeg(Number(rot.x) || 0),
          y: clampDeg(Number(rot.y) || 0),
          z: clampDeg(Number(rot.z) || 0),
        },
      };
    }
  }
  return result;
}

function clampDeg(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-180, Math.min(180, value));
}

export async function generatePoseFromText(
  prompt: string
): Promise<AIPoseResponse> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\nDescription: ${prompt}\n\nJSON:`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_TEXT_MODEL,
        prompt: fullPrompt,
        stream: false,
        format: 'json',
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama responded ${res.status}`);
    }
    const data = await res.json();
    const raw = (data.response as string) || '';
    const parsed = extractJson(raw);
    return { pose: normalizePose(parsed), description: prompt };
  } catch (err) {
    return {
      pose: fallbackPoseFromPrompt(prompt),
      description: prompt,
      confidence: 0,
    };
  }
}

export async function generatePoseFromImage(
  imageBase64: string,
  prompt?: string
): Promise<AIPoseResponse> {
  const visionPrompt = `${SYSTEM_PROMPT}\n\nAnalyze the pose in this image and return the R6 joint rotations as JSON. ${prompt || ''}`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_VISION_MODEL,
        prompt: visionPrompt,
        images: [imageBase64],
        stream: false,
        format: 'json',
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama vision responded ${res.status}`);
    }
    const data = await res.json();
    const raw = (data.response as string) || '';
    const parsed = extractJson(raw);
    return { pose: normalizePose(parsed), description: prompt };
  } catch (err) {
    return {
      pose: fallbackPoseFromPrompt(prompt || 'idle'),
      description: prompt,
      confidence: 0,
    };
  }
}

export function fallbackPoseFromPrompt(prompt: string): R6Pose {
  const p = prompt.toLowerCase();
  const base: R6Pose = {
    head: { ...DEFAULT_POSE.head, rotation: { ...DEFAULT_POSE.head.rotation } },
    torso: { ...DEFAULT_POSE.torso, rotation: { ...DEFAULT_POSE.torso.rotation } },
    leftArm: { ...DEFAULT_POSE.leftArm, rotation: { ...DEFAULT_POSE.leftArm.rotation } },
    rightArm: { ...DEFAULT_POSE.rightArm, rotation: { ...DEFAULT_POSE.rightArm.rotation } },
    leftLeg: { ...DEFAULT_POSE.leftLeg, rotation: { ...DEFAULT_POSE.leftLeg.rotation } },
    rightLeg: { ...DEFAULT_POSE.rightLeg, rotation: { ...DEFAULT_POSE.rightLeg.rotation } },
  };

  const isLeft = p.includes('left');
  if (p.includes('punch') || p.includes('hook') || p.includes('jab')) {
    if (isLeft) {
      base.leftArm.rotation = { x: -90, y: 0, z: 0 };
      base.torso.rotation = { x: 0, y: 20, z: 0 };
    } else {
      base.rightArm.rotation = { x: -90, y: 0, z: 0 };
      base.torso.rotation = { x: 0, y: -20, z: 0 };
    }
  } else if (p.includes('run') || p.includes('sprint')) {
    base.leftArm.rotation = { x: 60, y: 0, z: 0 };
    base.rightArm.rotation = { x: -60, y: 0, z: 0 };
    base.leftLeg.rotation = { x: -40, y: 0, z: 0 };
    base.rightLeg.rotation = { x: 40, y: 0, z: 0 };
    base.torso.rotation = { x: 10, y: 0, z: 0 };
  } else if (p.includes('jump')) {
    base.leftArm.rotation = { x: -150, y: 0, z: 10 };
    base.rightArm.rotation = { x: -150, y: 0, z: -10 };
    base.leftLeg.rotation = { x: 30, y: 0, z: 0 };
    base.rightLeg.rotation = { x: 30, y: 0, z: 0 };
  } else if (p.includes('wave')) {
    if (isLeft) {
      base.leftArm.rotation = { x: 0, y: 0, z: -150 };
    } else {
      base.rightArm.rotation = { x: 0, y: 0, z: 150 };
    }
  } else if (p.includes('kick')) {
    if (isLeft) {
      base.leftLeg.rotation = { x: -90, y: 0, z: 0 };
    } else {
      base.rightLeg.rotation = { x: -90, y: 0, z: 0 };
    }
  } else if (p.includes('crouch') || p.includes('squat')) {
    base.leftLeg.rotation = { x: -90, y: 0, z: 0 };
    base.rightLeg.rotation = { x: -90, y: 0, z: 0 };
    base.leftArm.rotation = { x: -30, y: 0, z: 15 };
    base.rightArm.rotation = { x: -30, y: 0, z: -15 };
  } else if (p.includes('t-pose') || p.includes('tpose')) {
    base.leftArm.rotation = { x: 0, y: 0, z: -90 };
    base.rightArm.rotation = { x: 0, y: 0, z: 90 };
  }
  return base;
}
