// pages/api/update-embeddings.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issueKey } = req.body;

  if (!issueKey) {
    res.status(400).json({ error: 'Issue key is required.' });
    return;
  }

  try {
    const issue = await jira.findIssue(issueKey, '', 'summary,description,issuetype,parent');
    const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    const embedding = embeddingResponse.data[0].embedding;

    const index = pinecone.index('masterz');

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

    res.status(200).json({ message: 'Embedding updated successfully.' });
  } catch (error) {
    console.error('Error updating embedding:', error);
    res.status(500).json({
      error: 'Failed to update embedding.',
    });
  }
}
