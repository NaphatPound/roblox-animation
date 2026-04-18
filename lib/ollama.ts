import type { AIPoseResult, AISource, R6Pose } from '@/types';
import { DEFAULT_POSE, clonePose } from '@/lib/pose';

// ---------- Config ---------------------------------------------------------

// Local Ollama daemon (`ollama serve`). Defaults to localhost:11434.
const OLLAMA_LOCAL_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// Ollama Cloud — https://docs.ollama.com/api/authentication
const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || 'https://ollama.com';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';

// Cloud-safe defaults when OLLAMA_TEXT_MODEL / OLLAMA_VISION_MODEL are unset
// but the backend has resolved to 'cloud'. Local mode uses smaller models
// that a dev laptop can actually run.
const CLOUD_TEXT_DEFAULT = 'gpt-oss:120b-cloud';
const CLOUD_VISION_DEFAULT = 'gemma4:31b-cloud';
const LOCAL_TEXT_DEFAULT = 'llama3.2';
const LOCAL_VISION_DEFAULT = 'gemma3';

export type Backend = 'cloud' | 'local';
export type BackendMode = Backend | 'auto';

export function resolveBackendMode(
  envValue: string | undefined = process.env.OLLAMA_BACKEND,
  hasKey: boolean = Boolean(OLLAMA_API_KEY)
): BackendMode {
  const raw = (envValue || '').trim().toLowerCase();
  if (raw === 'cloud' || raw === 'local') return raw;
  if (raw === 'auto' || raw === '') return 'auto';
  // unrecognised values behave like 'auto' to avoid throwing on typos.
  return 'auto';
}

export function planAttempts(
  mode: BackendMode,
  hasKey: boolean = Boolean(OLLAMA_API_KEY)
): Backend[] {
  if (mode === 'cloud') return hasKey ? ['cloud'] : [];
  if (mode === 'local') return ['local'];
  // auto: try cloud first if a key is set, then local.
  return hasKey ? ['cloud', 'local'] : ['local'];
}

export function resolveTextModel(
  backend: Backend,
  override: string | undefined = process.env.OLLAMA_TEXT_MODEL
): string {
  if (override && override.trim()) return override.trim();
  return backend === 'cloud' ? CLOUD_TEXT_DEFAULT : LOCAL_TEXT_DEFAULT;
}

export function resolveVisionModel(
  backend: Backend,
  override: string | undefined = process.env.OLLAMA_VISION_MODEL
): string {
  if (override && override.trim()) return override.trim();
  return backend === 'cloud' ? CLOUD_VISION_DEFAULT : LOCAL_VISION_DEFAULT;
}

// ---------- Prompt / parsing ----------------------------------------------

const SYSTEM_PROMPT = `You are a Roblox R6 character animation expert. You convert human descriptions or images of poses into joint rotations for a 6-part rig (head, torso, leftArm, rightArm, leftLeg, rightLeg).

Rules:
- Output ONLY raw JSON (no markdown, no commentary).
- Rotations are in Euler degrees on x,y,z axes.
- Valid range: -180 to 180.
- Positive x = pitch forward, positive y = yaw right, positive z = roll right.
- Schema: {"head":{"rotation":{"x":0,"y":0,"z":0}}, "torso":{...}, "leftArm":{...}, "rightArm":{...}, "leftLeg":{...}, "rightLeg":{...}}`;

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

// ---------- Transport ------------------------------------------------------

interface OllamaGenerateBody {
  model: string;
  prompt: string;
  stream: false;
  format?: 'json';
  images?: string[];
}

async function callOnce(
  backend: Backend,
  body: OllamaGenerateBody
): Promise<string> {
  const baseUrl = backend === 'cloud' ? OLLAMA_CLOUD_URL : OLLAMA_LOCAL_URL;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (backend === 'cloud') {
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
      `Ollama ${backend} responded ${res.status}` +
        (text ? `: ${text.slice(0, 200)}` : '')
    );
  }

  const data = (await res.json()) as { response?: string };
  return data.response || '';
}

/**
 * Walk through the attempt plan for the current backend selection. Each
 * attempt gets its own body (so the caller can pick the right model per
 * backend). Throws a combined error if all attempts fail.
 *
 * Pass `modeOverride` to force a specific backend for this single call
 * (used by batch image import to skip repeating cloud after the first
 * cloud failure in the batch).
 */
async function callOllama(
  makeBody: (backend: Backend) => OllamaGenerateBody,
  modeOverride?: BackendMode
): Promise<{ response: string; source: Backend }> {
  const mode = modeOverride ?? resolveBackendMode();
  const attempts = planAttempts(mode);
  if (attempts.length === 0) {
    throw new Error(
      'Ollama backend not configured — set OLLAMA_API_KEY for cloud or OLLAMA_URL for local'
    );
  }
  const errors: string[] = [];
  for (const backend of attempts) {
    try {
      const response = await callOnce(backend, makeBody(backend));
      return { response, source: backend };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(errors.join(' | '));
}

// ---------- Public generators ---------------------------------------------

export async function generatePoseFromText(
  prompt: string,
  backendOverride?: BackendMode
): Promise<AIPoseResult> {
  const fullPrompt = `${SYSTEM_PROMPT}\n\nDescription: ${prompt}\n\nJSON:`;
  try {
    const { response, source } = await callOllama(
      (backend) => ({
        model: resolveTextModel(backend),
        prompt: fullPrompt,
        stream: false,
        format: 'json',
      }),
      backendOverride
    );
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
      source: 'fallback' as AISource,
      error: message,
    };
  }
}

export async function generatePoseFromImage(
  imageBase64: string,
  prompt?: string,
  backendOverride?: BackendMode
): Promise<AIPoseResult> {
  const visionPrompt = `${SYSTEM_PROMPT}\n\nAnalyze the pose in this image and return the R6 joint rotations as JSON. ${prompt || ''}`;
  try {
    const { response, source } = await callOllama(
      (backend) => ({
        model: resolveVisionModel(backend),
        prompt: visionPrompt,
        images: [imageBase64],
        stream: false,
        format: 'json',
      }),
      backendOverride
    );
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
      source: 'fallback' as AISource,
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
