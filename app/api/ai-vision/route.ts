import { NextRequest, NextResponse } from 'next/server';
import { generatePoseFromImage } from '@/lib/ollama';

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
    const result = await generatePoseFromImage(imageBase64, prompt);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
