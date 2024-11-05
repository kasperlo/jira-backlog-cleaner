// pages/api/create-issue.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import JiraClient from 'jira-client';
import openai from '../../lib/openaiClient';
import pinecone from '../../lib/pineconeClient';

interface Suggestion {
  summary: string;
  description: string;
  issuetype: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    console.warn(`Method ${req.method} not allowed on /api/create-issue`);
    return;
  }

  const { suggestion, isEpic, config } = req.body;

  if (!config || !config.jiraEmail || !config.jiraApiToken || !config.jiraBaseUrl || !config.projectKey) {
    console.warn('Invalid Jira configuration provided:', config);
    res.status(400).json({ error: 'Invalid Jira configuration provided.' });
    return;
  }

  if (!suggestion || !suggestion.summary || !suggestion.description || !suggestion.issuetype) {
    res.status(400).json({ error: 'Suggestion with summary, description, and issuetype is required.' });
    return;
  }

  // Initialize Jira client with user-provided config
  const jira = new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });

  try {
    const issueData: any = {
      fields: {
        project: { key: config.projectKey },
        summary: suggestion.summary,
        description: suggestion.description,
        issuetype: { name: isEpic ? 'Epic' : suggestion.issuetype },
      },
    };

    if (isEpic) {
      issueData.fields['Epic Name'] = suggestion.summary; // Modify as needed
    }

    const issue = await jira.addNewIssue(issueData);

    // Generate embedding using text-embedding-3-large
    const text = `${suggestion.summary}\n${suggestion.description}`;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large', // Updated model
      input: text,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Upsert to Pinecone
    const index = pinecone.index('masterz-3072'); // Ensure this is the new index name

    await index.upsert([
      {
        id: issue.key,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: suggestion.summary,
          description: suggestion.description,
          issuetype: suggestion.issuetype,
          parentKey: '', // Adjust if necessary
          isEpic: isEpic,
        },
      },
    ]);

    res.status(200).json({ message: 'Issue created successfully.', issueKey: issue.key });
  } catch (error: any) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue.' });
  }
}
