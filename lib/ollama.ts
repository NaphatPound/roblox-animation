import type { R6Pose, AIPoseResponse } from '@/types';
import { DEFAULT_POSE, clonePose } from '@/lib/pose';

// Local Ollama daemon (e.g. `ollama serve`).
const OLLAMA_LOCAL_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// Ollama Cloud — https://docs.ollama.com/api/authentication
const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';

const OLLAMA_TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'llama3.2';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma3';

const SYSTEM_PROMPT = `You are a Roblox R6 character animation expert. You convert human descriptions or images of poses into joint rotations for a 6-part rig (head, torso, leftArm, rightArm, leftLeg, rightLeg).

Rules:
- Output ONLY raw JSON (no markdown, no commentary).
- Rotations are in Euler degrees on x,y,z axes.
- Valid range: -180 to 180.
- Positive x = pitch forward, positive y = yaw right, positive z = roll right.
- Schema: {"head":{"rotation":{"x":0,"y":0,"z":0}}, "torso":{...}, "leftArm":{...}, "rightArm":{...}, "leftLeg":{...}, "rightLeg":{...}}`;

type Source = 'cloud' | 'local' | 'fallback';

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
  const result: R6Pose = clonePose(DEFAULT_POSE);

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

interface OllamaGenerateBody {
  model: string;
  prompt: string;
  stream: false;
  format?: 'json';
  images?: string[];
}

/**
 * Pick the right Ollama endpoint + auth headers based on env:
 * - If OLLAMA_API_KEY is set, use Ollama Cloud (https://ollama.com) with a
 *   Bearer header — per https://docs.ollama.com/api/authentication.
 * - Otherwise call the local daemon (default http://localhost:11434) with
 *   no auth. Same JSON request/response shape either way.
 */
async function callOllama(
  body: OllamaGenerateBody
): Promise<{ response: string; source: Source }> {
  const useCloud = Boolean(OLLAMA_API_KEY);
  const baseUrl = useCloud ? OLLAMA_CLOUD_URL : OLLAMA_LOCAL_URL;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (useCloud) {
    headers.Authorization = `Bearer ${OLLAMA_API_KEY}`;
  }

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Ollama ${useCloud ? 'cloud' : 'local'} responded ${res.status}` +
        (text ? `: ${text.slice(0, 200)}` : '')
    );
  }

  const data = (await res.json()) as { response?: string };
  return {
    response: data.response || '',
    source: useCloud ? 'cloud' : 'local',
  };
}

export async function generatePoseFromText(
  prompt: string
): Promise<AIPoseResponse & { source: Source; error?: string }> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\nDescription: ${prompt}\n\nJSON:`;

  try {
    const { response, source } = await callOllama({
      model: OLLAMA_TEXT_MODEL,
      prompt: fullPrompt,
      stream: false,
      format: 'json',
    });
    const parsed = extractJson(response);
    return {
      pose: normalizePose(parsed),
      description: prompt,
      source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      pose: fallbackPoseFromPrompt(prompt),
      description: prompt,
      confidence: 0,
      source: 'fallback',
      error: message,
    };
  }
}

export async function generatePoseFromImage(
  imageBase64: string,
  prompt?: string
): Promise<AIPoseResponse & { source: Source; error?: string }> {
  const visionPrompt = `${SYSTEM_PROMPT}\n\nAnalyze the pose in this image and return the R6 joint rotations as JSON. ${prompt || ''}`;

  try {
    const { response, source } = await callOllama({
      model: OLLAMA_VISION_MODEL,
      prompt: visionPrompt,
      images: [imageBase64],
      stream: false,
      format: 'json',
    });
    const parsed = extractJson(response);
    return {
      pose: normalizePose(parsed),
      description: prompt,
      source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      pose: fallbackPoseFromPrompt(prompt || 'idle'),
      description: prompt,
      confidence: 0,
      source: 'fallback',
      error: message,
    };
  }
}

export function fallbackPoseFromPrompt(prompt: string): R6Pose {
  const p = prompt.toLowerCase();
  const base: R6Pose = clonePose(DEFAULT_POSE);

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
