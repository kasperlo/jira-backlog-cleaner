// app/api/issues/route.ts

import { NextResponse } from 'next/server';
import {
  fetchAllIssues,
  generateEmbeddings,
  upsertEmbeddingsToPinecone,
} from '../../../utils/issueProcessor';
import { resetProgress, updateProgress, completeProgress, setError } from '../../../lib/progressStore';
import { JiraIssue } from '../../../types/types';

export async function POST(request: Request) {
  const { config, action } = await request.json();

  // Validate Jira configuration
  if (
    !config ||
    !config.jiraEmail ||
    !config.jiraApiToken ||
    !config.jiraBaseUrl ||
    !config.projectKey
  ) {
    console.warn('Invalid Jira configuration:', config);
    return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
  }

  if (action === 'process') {
    try {
      // Fetch all issues from Jira
      const issues: JiraIssue[] = await fetchAllIssues(config);
      console.log(`Total issues fetched: ${issues.length}`);

      if (issues.length === 0) {
        return NextResponse.json({ message: 'No issues found to process.' }, { status: 200 });
      }

      // Reset progress
      resetProgress(issues.length);

      // Generate embeddings
      const vectors = await generateEmbeddings(issues);

      // Update progress
      for (let i = 0; i < vectors.length; i++) {
        updateProgress();
      }

      // Upsert embeddings to Pinecone
      await upsertEmbeddingsToPinecone(vectors);

      // Complete progress
      completeProgress();
      console.log('Processing completed.');

      // Return the processed issues to the frontend
      return NextResponse.json({ issues }, { status: 200 });
    } catch (error: unknown) {
      console.error('Error processing issues:', error);
      setError(
        error instanceof Error ? error.message : 'Unknown error during processing.'
      );
      return NextResponse.json({ error: 'Failed to process issues.' }, { status: 500 });
    }
  }

  // Default response if action is not recognized
  return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 });
}
