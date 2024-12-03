// app/api/detect-duplicates/route.ts

import { NextResponse } from 'next/server';
import { detectDuplicatesWithPinecone } from '../../../utils/detectDuplicates';

export async function POST(request: Request) {
  try {
    const { issues, config } = await request.json();

    if (!issues || !Array.isArray(issues) || issues.length === 0 || !config) {
      console.warn('Invalid issues or config provided:', issues, config);
      return NextResponse.json({ error: 'Invalid issues or Jira config provided.' }, { status: 400 });
    }

    const duplicateGroups = await detectDuplicatesWithPinecone(issues);
    return NextResponse.json({ duplicates: duplicateGroups }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error detecting duplicates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to detect duplicates';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
