// jira-backlog-cleaner/app/api/issues/route.ts

import { NextResponse } from 'next/server';
import { JiraIssue } from '../../../types/types';
import {
  fetchAllIssues,
  generateEmbeddings,
  upsertEmbeddingsToPinecone,
} from '../../../utils/issueProcessor';
import {
  resetProgress,
  updateProgress,
  completeProgress,
  setError,
  getProgress,
} from '../../../lib/progressStore';

let processedIssuesList: JiraIssue[] = []; // Module-level variable

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

  if (action === 'fetchProcessedIssues') {
    // Return the list of processed issues
    return NextResponse.json({ issues: processedIssuesList }, { status: 200 });
  }

  if (action === 'process') {
    // Check if processing is already in progress
    const progress = getProgress();
    if (progress.status === 'processing') {
      console.warn('Processing already in progress.');
      return NextResponse.json({ error: 'Processing is already in progress.' }, { status: 409 });
    }

    try {
      // Fetch all issues from Jira
      const issues: JiraIssue[] = await fetchAllIssues(config);
      console.log(`Total issues fetched: ${issues.length}`);

      if (issues.length === 0) {
        return NextResponse.json({ message: 'No issues found to process.' }, { status: 200 });
      }

      // Reset progress and processed issues list
      resetProgress(issues.length);
      processedIssuesList = []; // Reset the list

      // Start asynchronous processing
      (async () => {
        try {
          const vectors = await generateEmbeddings(issues);

          // Update progress as embeddings are generated
          for (let i = 0; i < vectors.length; i++) {
            updateProgress();
            processedIssuesList.push(issues[i]);
          }

          await upsertEmbeddingsToPinecone(vectors);

          // Complete progress
          completeProgress();
          console.log('Processing completed.');
        } catch (processingError: unknown) {
          console.error('Error during embedding processing:', processingError);
          setError(
            processingError instanceof Error
              ? processingError.message
              : 'Unknown error during processing.'
          );
        }
      })();

      // Respond immediately to the frontend
      return NextResponse.json({ message: 'Processing started.', total: issues.length }, { status: 202 });
    } catch (error: unknown) {
      console.error(
        'Error fetching Jira issues:',
        error instanceof Error ? error.message : error
      );
      setError(error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json({ error: 'Failed to fetch Jira issues.' }, { status: 500 });
    }
  }

  // Default response if action is not recognized
  return NextResponse.json({ error: 'Invalid action specified.' }, { status: 400 });
}
