// pages/api/issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { JiraConfig, JiraIssue } from '../../types/types';
import { fetchAllIssues, generateEmbeddings, upsertEmbeddingsToPinecone } from '../../utils/issueProcessor';
import {
  resetProgress,
  updateProgress,
  completeProgress,
  setError,
  getProgress,
} from '../../lib/progressStore';

export {}; // Ensure this file is treated as a module

declare global {
  var processedIssuesList: JiraIssue[];
}

// Initialize 'processedIssuesList' if it doesn't exist
if (typeof globalThis.processedIssuesList === 'undefined') {
  globalThis.processedIssuesList = [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { config, action } = req.body;

  // Validate Jira configuration
  if (
    !config ||
    !config.jiraEmail ||
    !config.jiraApiToken ||
    !config.jiraBaseUrl ||
    !config.projectKey
  ) {
    res.status(400).json({ error: 'Invalid Jira configuration provided.' });
    console.warn('Invalid Jira configuration:', config);
    return;
  }

  if (action === 'fetchProcessedIssues') {
    // Return the list of processed issues
    res.status(200).json({ issues: globalThis.processedIssuesList });
    return;
  }

  if (action === 'process') {
    // Check if processing is already in progress
    const progress = getProgress();
    if (progress.status === 'processing') {
      console.warn('Processing already in progress.');
      res.status(409).json({ error: 'Processing is already in progress.' });
      return;
    }

    try {
      // Fetch all issues from Jira
      const issues: JiraIssue[] = await fetchAllIssues(config);
      console.log(`Total issues fetched: ${issues.length}`);

      if (issues.length === 0) {
        res.status(200).json({ message: 'No issues found to process.' });
        return;
      }

      // Reset progress and processed issues list
      resetProgress(issues.length);
      globalThis.processedIssuesList = []; // Reset the list

      // Start asynchronous processing
      (async () => {
        try {
          const vectors = await generateEmbeddings(issues);

          // Update progress as embeddings are generated
          for (let i = 0; i < vectors.length; i++) {
            updateProgress();
            globalThis.processedIssuesList.push(issues[i]);
          }

          await upsertEmbeddingsToPinecone(vectors);

          // Complete progress
          completeProgress();
          console.log('Processing completed.');
        } catch (processingError: any) {
          console.error('Error during embedding processing:', processingError);
          setError(processingError.message || 'Unknown error during processing.');
        }
      })();

      // Respond immediately to the frontend
      res.status(202).json({ message: 'Processing started.', total: issues.length });
    } catch (error: any) {
      console.error('Error fetching Jira issues:', error.message || error);
      setError(error.message || 'Unknown error');
      res.status(500).json({ error: 'Failed to fetch Jira issues.' });
    }
    return;
  }

  // Default response if action is not recognized
  res.status(400).json({ error: 'Invalid action specified.' });
}
