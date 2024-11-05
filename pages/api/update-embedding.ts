// pages/api/update-embeddings.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createJiraClient } from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';
import { Pinecone } from '@pinecone-database/pinecone';
import { JiraConfig } from '../../types/types';

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
  };
}

interface VectorMetadata {
  id: string;
  values: number[];
  sparseValues?: any;
  metadata?: Record<string, any>;
}

interface FetchResponse {
  vectors: Record<string, VectorMetadata>;
}

const pinecone = new Pinecone();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issueKey, config } = req.body;

  if (!issueKey || !config) {
    res.status(400).json({ error: 'Issue key and Jira config are required.' });
    return;
  }

  // Validate JiraConfig structure (optional but recommended)
  const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config as JiraConfig;
  if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
    return res.status(400).json({ error: 'Incomplete Jira configuration.' });
  }

  // Instantiate JiraClient with the provided config
  const jiraClient = createJiraClient(config as JiraConfig);

  try {
    // Fetch the issue
    const issue = await jiraClient.findIssue(issueKey, '', 'summary,description,issuetype,parent');

    // Log fetching the issue
    console.log(`fetched ${issue.key} from jira`);

    const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // Log embedding creation
    console.log(`created vector embedding for ${issue.key} in pinecone`);

    const index = pinecone.index('masterz-3072');

    await index.upsert([
      {
        id: issueKey,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description || '',
          issuetype: issue.fields.issuetype.name,
          parentKey: issue.fields.parent?.key || '',
        },
      },
    ]);

    // Log embedding upsert
    console.log(`updated vector embedding for ${issue.key} in pinecone`);

    res.status(200).json({ message: 'Embedding updated successfully.' });
  } catch (error: any) {
    console.error('Error updating embedding:', error.response?.data || error);
    res.status(500).json({
      error: error.response?.data?.errorMessages?.[0] || 'Failed to update embedding.',
    });
  }
}
