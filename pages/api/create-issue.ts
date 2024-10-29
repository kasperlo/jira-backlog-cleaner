// pages/api/create-issue.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';
import pinecone from '../../lib/pineconeClient';

interface Suggestion {
  summary: string;
  description: string;
  issuetype: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { suggestion, isEpic } = req.body; // Accept an additional parameter to specify if it's an Epic

  if (!suggestion) {
    res.status(400).json({ error: 'Suggestion data is required.' });
    return;
  }

  try {
    // Adjust fields based on whether we're creating an Epic or a regular issue
    const issueData = {
      fields: {
        project: { key: 'BG' }, // Replace with your project key
        summary: suggestion.summary,
        description: suggestion.description,
        issuetype: { name: isEpic ? 'Epic' : suggestion.issuetype }, // Use Epic if specified
      },
    };

    const issue = await jira.addNewIssue(issueData);

    // Update the embedding in Pinecone
    const text = `${suggestion.summary}\n${suggestion.description || ''}`;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    const embedding = embeddingResponse.data[0].embedding;

    const index = pinecone.index('masterz');

    // Directly pass the array of vectors to upsert
    await index.upsert([
      {
        id: issue.key,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: suggestion.summary,
          description: suggestion.description || '',
          issuetype: suggestion.issuetype,
          parentKey: '', // Adjust if necessary
        },
      },
    ]);

    res.status(200).json({ message: 'Issue created successfully.', issueKey: issue.key });
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue.' });
  }
}
