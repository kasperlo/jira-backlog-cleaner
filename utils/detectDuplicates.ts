// jira-backlog-cleaner/utils/detectDuplicates.ts

import pinecone from '../lib/pineconeClient';
import { JiraIssue, DuplicateGroup } from '../types/types';
import { PINECONE_INDEX_NAME } from '../config';

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

export async function detectDuplicatesWithPinecone(issues: JiraIssue[]): Promise<DuplicateGroup[]> {
  const index = pinecone.Index(PINECONE_INDEX_NAME);
  const duplicateGroups: DuplicateGroup[] = [];
  const processedIssues = new Set<string>();
  const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75');

  for (const issue of issues) {
    if (processedIssues.has(issue.key)) continue;

    const fetchResponse = (await index.fetch([issue.key])) as FetchResponse;
    const vector = fetchResponse.records[issue.key];

    if (!vector) {
      console.error(`Embedding not found for issue ${issue.key}`);
      continue;
    }

    const embedding = vector.values;

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

      if (processedIssues.has(matchedIssueKey)) {
        continue;
      }

      const matchedIssue = issues.find((i) => i.key === matchedIssueKey);

      if (matchedIssue) {
        duplicateGroups.push({
          group: [issue, matchedIssue],
          explanation: `Issues '${issue.key}' and '${matchedIssue.key}' are duplicates based on a similarity score of ${bestMatch.score!.toFixed(
            2
          )}.`,
          similarityScore: bestMatch.score!, // Add this line
        });

        processedIssues.add(issue.key);
        processedIssues.add(matchedIssue.key);
      }
    }
  }

  return duplicateGroups;
}
