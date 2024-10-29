// pages/api/issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';
import pinecone from '../../lib/pineconeClient';

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

interface PineconeVector {
  id: string;
  values: number[];
  metadata?: {
    [key: string]: any;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const jql = 'project = "BG"'; // Fetch all issues in project BG
    const maxResults = 1000; // Maximum allowed by Jira per request
    let startAt = 0;
    let total = 0;
    let allIssues: JiraIssue[] = [];

    do {
      const response = await jira.searchJira(jql, {
        fields: ['summary', 'description', 'issuetype', 'parent', 'status'],
        maxResults,
        startAt,
      });

      if (!response || !response.issues) {
        console.error('Invalid or empty response from Jira API:', response);
        res.status(500).json({ error: 'Received empty response from Jira API' });
        return;
      }

      allIssues = allIssues.concat(response.issues);
      total = response.total;
      startAt += response.maxResults;

      console.log(`Fetched ${response.issues.length} issues, total fetched so far: ${allIssues.length}`);
    } while (startAt < total);

    // Process all issues to ensure they are in Pinecone
    await processIssuesForPinecone(allIssues);

    res.status(200).json({ issues: allIssues });
  } catch (error: any) {
    console.error('Error fetching Jira issues:', error);

    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
      console.error('Error response data:', error.response.data);
    } else {
      console.error('Error message:', error.message);
    }

    res.status(500).json({ error: error.message || 'Failed to fetch Jira issues' });
  }
}

async function processIssuesForPinecone(issues: JiraIssue[]) {
  try {
    const index = pinecone.index('masterz'); // Use your index name
    const upsertVectors: PineconeVector[] = [];
    const BATCH_SIZE = 100;

    // Fetch existing vector IDs from Pinecone
    const existingIds = await fetchExistingIds(index, issues.map(issue => issue.key));

    for (const issue of issues) {
      if (existingIds.has(issue.key)) {
        continue; // Skip if already exists
      }

      const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;

      // Generate embedding
      let embedding: number[];
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: text,
        });
        embedding = embeddingResponse.data[0].embedding;
      } catch (error) {
        console.error(`Error generating embedding for issue ${issue.key}:`, error);
        continue; // Skip this issue and continue processing others
      }

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

      if (upsertVectors.length >= BATCH_SIZE) {
        try {
          // Upsert the batch by passing the array directly
          await index.upsert(upsertVectors);
          upsertVectors.length = 0; // Clear the array
        } catch (error) {
          console.error('Error upserting vectors to Pinecone:', error);
          throw error; // Re-throw the error
        }
      }
    }

    // Upsert any remaining vectors
    if (upsertVectors.length > 0) {
      try {
        await index.upsert(upsertVectors); // Pass the array directly
      } catch (error) {
        console.error('Error upserting vectors to Pinecone:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in processIssuesForPinecone:', error);
    throw error; // Rethrow to be handled by the caller
  }
}

async function fetchExistingIds(index: any, ids: string[]): Promise<Set<string>> {
  const existingIds = new Set<string>();
  const CHUNK_SIZE = 100; // Pinecone fetch can handle up to 100 IDs at a time

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    try {
      const fetchResponse = await index.fetch(chunk); // Corrected here
      const vectors = fetchResponse?.vectors || {};
      for (const id in vectors) {
        existingIds.add(id);
      }
    } catch (error) {
      console.error('Error fetching existing IDs from Pinecone:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  return existingIds;
}


