// pages/api/issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import JiraClient from 'jira-client';
import openai from '../../lib/openaiClient';
import pinecone from '../../lib/pineconeClient';
import {
  resetProgress,
  updateProgress,
  completeProgress,
  setError,
  getProgress,
} from '../../lib/progressStore';

export {}; // Ensure this file is treated as a module

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    parent?: {
      key: string;
    };
    created: string;
    subtasks?: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        description?: string;
        issuetype: {
          name: string;
        };
        parent?: {
          key: string;
        };
      };
    }>;
  };
}

interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

// Declare the global variable
declare global {
  var processedIssuesList: JiraIssue[];
}

// Initialize 'processedIssuesList' if it doesn't exist
if (typeof globalThis.processedIssuesList === 'undefined') {
  globalThis.processedIssuesList = [];
}

// Helper function to fetch all issues with pagination
const fetchAllIssues = async (jira: JiraClient, jql: string): Promise<JiraIssue[]> => {
  let startAt = 0;
  const maxResults = 100; // Adjust as needed
  let allIssues: JiraIssue[] = [];
  let total = 0;

  do {
    const response = await jira.searchJira(jql, {
      fields: ['summary', 'description', 'issuetype', 'parent', 'created', 'subtasks'],
      maxResults,
      startAt,
    });

    const fetchedIssues: JiraIssue[] = response.issues;
    allIssues = allIssues.concat(fetchedIssues);
    total = response.total;
    startAt += maxResults;

    console.log(
      `Fetched ${fetchedIssues.length} issues. Total fetched so far: ${allIssues.length}/${total}`
    );
  } while (allIssues.length < total);

  return allIssues;
};

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

  // Initialize Jira client with user-provided configuration
  const jira = new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });

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
      // Construct JQL to fetch issues from the specified project
      const jql = `project = "${config.projectKey}" ORDER BY created DESC`;

      // Fetch all issues from Jira with pagination
      const issues: JiraIssue[] = await fetchAllIssues(jira, jql);
      console.log(`Total issues fetched: ${issues.length}`);

      if (issues.length === 0) {
        res.status(200).json({ message: 'No issues found to process.' });
        return;
      }

      // Initialize Pinecone index
      const indexName = 'your-index-name'; // Replace with your index name
      const index = pinecone.Index(indexName);

      const upsertVectors: PineconeVector[] = [];

      // Reset progress and processed issues list
      resetProgress(issues.length);
      globalThis.processedIssuesList = []; // Reset the list

      // Start asynchronous processing
      (async () => {
        try {
          for (const issue of issues) {
            // Log processing issue
            console.log(`Processing issue ${issue.key}`);

            // Combine summary and description
            const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;

            // Generate embedding using OpenAI
            const embeddingResponse = await openai.embeddings.create({
              model: 'text-embedding-ada-002',
              input: text,
            });
            const embedding = embeddingResponse.data[0].embedding;

            // Log embedding creation
            console.log(`Created vector embedding for ${issue.key}`);

            // Prepare the vector for Pinecone
            upsertVectors.push({
              id: issue.key,
              values: embedding,
              metadata: {
                issueKey: issue.key,
                summary: issue.fields.summary,
                description: issue.fields.description || '',
                issuetype: issue.fields.issuetype.name,
                parentKey: issue.fields.parent?.key || '',
              },
            });

            // Update progress
            updateProgress();

            // Add the processed issue to the global list
            globalThis.processedIssuesList.push(issue);

            // Upsert in batches
            if (upsertVectors.length === 100) {
              await index.upsert(upsertVectors);
              console.log(`Upserted batch of 100 issues to Pinecone`);
              upsertVectors.length = 0; // Clear the array
            }
          }

          // Upsert any remaining vectors
          if (upsertVectors.length > 0) {
            await index.upsert(upsertVectors);
            console.log(`Upserted final batch of ${upsertVectors.length} issues to Pinecone`);
          }

          // Complete progress
          completeProgress();
          console.log('Processing completed.');

          // Optionally, verify the total vectors in Pinecone
          const stats = await index.describeIndexStats();
          console.log(`Total vectors in Pinecone index: ${stats.totalRecordCount}`);
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
