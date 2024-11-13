// jira-backlog-cleaner/app/api/progress/route.ts

import { NextResponse } from 'next/server';
import { getProgress } from '../../../lib/progressStore';
import { ProgressData } from '../../../types/types';

export async function GET() {
  try {
    const progress: ProgressData = getProgress();
    console.log(`Progress endpoint accessed. Current status: ${progress.status}`);
    return NextResponse.json(progress, { status: 200 });
  } catch (error) {
    console.error('Error accessing progress:', error);
    return NextResponse.json({ error: 'Failed to retrieve progress data.' }, { status: 500 });
  }
}
