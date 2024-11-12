// pages/api/get-similar-issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import openai from '../../../lib/openaiClient';
import pinecone from '../../../lib/pineconeClient';
import { SimilarIssue } from '../../../types/types';
import Ajv from 'ajv';
import { retryWithExponentialBackoff } from '@/utils/retry';

interface ErrorWithResponse {
  response: {
    status: number;
    data: unknown;
  };
}

// Initialize AJV for JSON schema validation
const ajv = new Ajv();
const similarIssueSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      summary: { type: 'string' },
      issuetype: { type: 'string' },
      similarity: { type: 'number' },
    },
    required: ['key', 'summary', 'issuetype', 'similarity'],
    additionalProperties: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { summary, config } = req.body;

  if (!summary) {
    res.status(400).json({ error: 'Issue summary is required.' });
    return;
  }

  if (!config) {
    res.status(400).json({ error: 'Jira configuration is required.' });
    return;
  }

  try {
    console.log(`Generating embedding for suggestion summary: ${summary}`);

    // Generate embedding for the suggestion summary
    const embeddingResponse = await retryWithExponentialBackoff(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: summary,
      })
    );

    console.log('Embedding generated successfully for suggestion summary.');

    const suggestionEmbedding = embeddingResponse.data[0].embedding;

    // Retrieve top 3 similar issues from Pinecone
    console.log('Retrieving top 3 similar issues using Pinecone...');
    const similarIssuesResponse = await pinecone.index('masterz-3072').query({
      vector: suggestionEmbedding,
      topK: 3,
      includeMetadata: true,
      includeValues: false,
    });

    // Check if matches exist
    if (!similarIssuesResponse.matches) {
      console.warn('No similar issues found.');
      res.status(200).json({ similarIssues: [] });
      return;
    }

    // Define RecordMetadata interface
    interface RecordMetadata {
      issueKey: string;
      summary: string;
      issuetype: string;
    }

    const similarIssues: SimilarIssue[] = similarIssuesResponse.matches.map((match) => {
      const metadata = match.metadata as unknown as RecordMetadata;

      return {
        key: match.id,
        summary: metadata.summary || 'No summary provided.',
        issuetype: metadata.issuetype || 'Unknown',
        similarity: typeof match.score === 'number' ? match.score : 0,
      };
    });

    // Validate the response against the schema
    const validate = ajv.compile(similarIssueSchema);
    const valid = validate(similarIssues);

    if (!valid) {
      console.error('Validation errors:', validate.errors);
      throw new Error('Invalid similar issues format received.');
    }

    res.status(200).json({ similarIssues });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as ErrorWithResponse;
      console.error(
        'OpenAI API Error:',
        axiosError.response.status,
        axiosError.response.data
      );
    } else if (error instanceof Error) {
      console.error('Error retrieving similar issues:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
    res.status(500).json({ error: 'Failed to retrieve similar issues.' });
  }
}
