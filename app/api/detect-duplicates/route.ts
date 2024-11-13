// jira-backlog-cleaner/app/api/detect-duplicates/route.ts

import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
  try {
    const { issues, config } = await request.json();

    if (!issues || !Array.isArray(issues) || issues.length === 0 || !config) {
      console.warn('Invalid issues or config provided:', issues, config);
      return NextResponse.json({ error: 'Invalid issues or Jira config provided.' }, { status: 400 });
    }

    const duplicateGroups = await detectDuplicatesWithPinecone(issues);
    return NextResponse.json({ duplicates: duplicateGroups }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error detecting duplicates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to detect duplicates';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
