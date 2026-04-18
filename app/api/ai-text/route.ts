import { NextRequest, NextResponse } from 'next/server';
import { generatePoseFromText } from '@/lib/ollama';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.prompt ?? '').toString().trim();
    if (!prompt) {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }
    const result = await generatePoseFromText(prompt);
    // Upstream failure — propagate as 502 so clients don't silently import
    // the keyword-heuristic fallback as if it were AI output. The pose is
    // still included so clients can degrade gracefully if they want.
    const status = result.source === 'fallback' ? 502 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
