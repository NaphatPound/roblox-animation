import { NextRequest, NextResponse } from 'next/server';
import { generatePoseFromImage, type BackendMode } from '@/lib/ollama';

function parseBackend(value: unknown): BackendMode | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'cloud' || v === 'local' || v === 'auto') return v;
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const imageBase64 = (body.imageBase64 ?? '').toString();
    if (!imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      );
    }
    const prompt = body.prompt ? body.prompt.toString() : undefined;
    // Optional per-request backend pin. Image batches pass this after the
    // first cloud failure so the rest of the batch doesn't re-pay the
    // cloud timeout on every frame (report04 #2).
    const backend = parseBackend(body.backend);
    const result = await generatePoseFromImage(imageBase64, prompt, backend);
    const status = result.source === 'fallback' ? 502 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
