// pages/api/issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import JiraClient from 'jira-client';
import openai from '../../lib/openaiClient';
import pinecone from '../../lib/pineconeClient';

// Define the structure of Jira issues
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

// Define the structure of Pinecone vectors
interface PineconeVector {
  id: string;
  values: number[];
  metadata?: {
    issueKey: string;
    summary: string;
    description: string;
    issuetype: string;
    parentKey: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { config } = req.body;

  // Validate Jira configuration
  if (
    !config ||
    !config.jiraEmail ||
    !config.jiraApiToken ||
    !config.jiraBaseUrl ||
    !config.projectKey
  ) {
    res.status(400).json({ error: 'Invalid Jira configuration provided.' });
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

  try {
    // Construct JQL to fetch issues from the specified project
    const jql = `project = "${config.projectKey}" ORDER BY created DESC`;

    // Fetch issues from Jira
    const response = await jira.searchJira(jql, {
      fields: ['summary', 'description', 'issuetype', 'parent', 'created', 'subtasks'],
      maxResults: 1000, // Adjust as needed
    });

    const issues: JiraIssue[] = response.issues;

    // Initialize Pinecone index
    const indexName = 'masterz-3072'; // Ensure this is the new index name with 3072 dimensions
    const index = pinecone.index(indexName);

    const upsertVectors: PineconeVector[] = [];

    for (const issue of issues) {
      // Combine summary and description
      const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;

      // Generate embedding using OpenAI
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large', // Updated model
        input: text,
      });

      const embedding = embeddingResponse.data[0].embedding;

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

      // Optionally handle subtasks if needed
      // For simplicity, we are only upserting top-level issues
    }

    // Batch upsert vectors to Pinecone
    const BATCH_SIZE = 100;
    for (let i = 0; i < upsertVectors.length; i += BATCH_SIZE) {
      const batch = upsertVectors.slice(i, i + BATCH_SIZE);
      await index.upsert(batch);
      console.log(`Upserted batch ${i / BATCH_SIZE + 1}`);
    }

    res.status(200).json({ issues });
  } catch (error: any) {
    console.error('Error fetching Jira issues:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch Jira issues.' });
  }
}