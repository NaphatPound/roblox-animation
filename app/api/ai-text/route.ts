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
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
