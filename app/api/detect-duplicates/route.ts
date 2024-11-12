// pages/api/detect-duplicates.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import pinecone from '../../../lib/pineconeClient';
import { JiraIssue, DuplicateGroup } from '../../../types/types';

interface FetchResponse {
  records: {
    [id: string]: {
      id: string;
      values: number[];
      sparseValues?: {
        indices: number[];
        values: number[];
      };
      metadata?: Record<string, unknown>;
    };
  };
  namespace?: string;
  usage?: {
    readUnits?: number;
  };
}

/**
 * Detects duplicate pairs using Pinecone similarity search.
 * @param issues - Array of Jira issues to analyze.
 * @returns Array of DuplicateGroup containing only pairs.
 */
export async function detectDuplicatesWithPinecone(issues: JiraIssue[]): Promise<DuplicateGroup[]> {
  const index = pinecone.Index('masterz-3072');
  const duplicateGroups: DuplicateGroup[] = [];
  const processedIssues = new Set<string>();
  const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75');

  for (const issue of issues) {
    if (processedIssues.has(issue.key)) continue;

    // Fetch the issue's embedding from Pinecone
    const fetchResponse = (await index.fetch([issue.key])) as FetchResponse;

    const vector = fetchResponse.records[issue.key];

    if (!vector) {
      console.error(`Embedding not found for issue ${issue.key}`);
      continue;
    }

    const embedding = vector.values;

    // Perform similarity search
    const queryResponse = await index.query({
      vector: embedding,
      topK: 2,
      includeMetadata: true,
      includeValues: false,
    });

    const similarIssues = queryResponse.matches
      ?.filter(
        (match) =>
          match.id !== issue.key &&
          match.score !== undefined &&
          match.score >= SIMILARITY_THRESHOLD
      )
      .sort((a, b) => b.score! - a.score!) || [];

    if (similarIssues.length > 0) {
      const bestMatch = similarIssues[0];
      const matchedIssueKey = bestMatch.id;

      // Check if the matched issue is already processed
      if (processedIssues.has(matchedIssueKey)) {
        continue;
      }

      // Find the matched issue details
      const matchedIssue = issues.find((i) => i.key === matchedIssueKey);

      if (matchedIssue) {
        // Create a duplicate group with the pair
        duplicateGroups.push({
          group: [issue, matchedIssue],
          explanation: `Issues '${issue.key}' and '${matchedIssue.key}' are duplicates based on a similarity score of ${bestMatch.score!.toFixed(
            2
          )}.`,
        });

        // Mark both issues as processed
        processedIssues.add(issue.key);
        processedIssues.add(matchedIssue.key);
      }
    }
  }

  return duplicateGroups;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    console.warn(`Method ${req.method} not allowed on /api/detect-duplicates`);
    return;
  }

  const { issues, config } = req.body;

  if (!issues || !Array.isArray(issues) || issues.length === 0 || !config) {
    console.warn('Invalid issues or config provided:', issues, config);
    res.status(400).json({ error: 'Invalid issues or Jira config provided.' });
    return;
  }

  try {
    const duplicateGroups = await detectDuplicatesWithPinecone(issues);
    res.status(200).json({ duplicates: duplicateGroups });
  } catch (error: unknown) {
    console.error('Error detecting duplicates:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to detect duplicates',
    });
  }
}
