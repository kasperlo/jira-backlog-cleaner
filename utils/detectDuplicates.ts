// utils/detectDuplicates.ts

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
  const processedPairs = new Set<string>();
  const groupedIssues = new Set<string>(); // Track issues already in a group
  const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7');

  // Create a map of issue key to set of duplicate issue keys
  const issueToDuplicateKeys = new Map<string, Set<string>>();

  // Build the map of existing duplicate links
  for (const issue of issues) {
    const duplicateKeys = new Set<string>();

    if (issue.fields.issuelinks) {
      for (const link of issue.fields.issuelinks) {
        const linkType = link.type.name.toLowerCase();

        if (linkType.includes('duplicate') || linkType.includes('clone')) {
          if (link.outwardIssue && link.outwardIssue.key) {
            duplicateKeys.add(link.outwardIssue.key);
          }
          if (link.inwardIssue && link.inwardIssue.key) {
            duplicateKeys.add(link.inwardIssue.key);
          }
        }
      }
    }

    issueToDuplicateKeys.set(issue.key, duplicateKeys);
  }

  // Create a map for quick issue lookup
  const issueMap = new Map<string, JiraIssue>();
  issues.forEach(issue => issueMap.set(issue.key, issue));

  for (const issue of issues) {
    // Skip if issue is already part of a duplicate group
    if (groupedIssues.has(issue.key)) {
      continue;
    }

    // Fetch the vector for the current issue
    const fetchResponse = (await index.fetch([issue.key])) as FetchResponse;
    const vector = fetchResponse.records[issue.key];

    if (!vector) {
      console.error(`Embedding not found for issue ${issue.key}`);
      continue;
    }

    const embedding = vector.values;

    // Query Pinecone for similar issues
    const queryResponse = await index.query({
      vector: embedding,
      topK: 10,
      includeMetadata: true,
      includeValues: false,
    });

    const similarIssues =
      queryResponse.matches?.filter(
        (match) =>
          match.id !== issue.key &&
          match.score !== undefined &&
          match.score >= SIMILARITY_THRESHOLD
      ) || [];

    for (const match of similarIssues) {
      const matchedIssueKey = match.id;

      // Skip if matched issue is already part of a duplicate group
      if (groupedIssues.has(matchedIssueKey)) {
        continue;
      }

      // Create a unique key for the pair to avoid processing the same pair in reverse
      const pairKey = [issue.key, matchedIssueKey].sort().join('-');
      if (processedPairs.has(pairKey)) {
        continue;
      }

      // Check if these issues are already linked as duplicates or clones
      const issueDuplicateKeys = issueToDuplicateKeys.get(issue.key) || new Set();
      if (issueDuplicateKeys.has(matchedIssueKey)) {
        continue;
      }

      const matchedIssue = issueMap.get(matchedIssueKey);

      if (matchedIssue) {
        // Filter out duplicate groups where both issues are "Done"
        const issueStatus = issue.fields.status?.name.toLowerCase();
        const matchedIssueStatus = matchedIssue.fields.status?.name.toLowerCase();
        if (issueStatus === 'done' && matchedIssueStatus === 'done') {
          continue;
        }

        // Collect existing link types between issue and matchedIssue
        const existingLinkTypes = getExistingLinkTypes(issue, matchedIssue);

        duplicateGroups.push({
          group: [issue, matchedIssue],
          explanation: `Issues '${issue.key}' and '${matchedIssue.key}' are duplicates based on a similarity score of ${match.score!.toFixed(
            2
          )}.`,
          similarityScore: match.score!,
          linkTypes: existingLinkTypes,
        });

        // Mark both issues as grouped
        groupedIssues.add(issue.key);
        groupedIssues.add(matchedIssueKey);

        // Mark the pair as processed
        processedPairs.add(pairKey);

        // Break to ensure each issue is only in one group per iteration
        break;
      }
    }
  }

  return duplicateGroups;
}

// Helper function to get existing link types between two issues
function getExistingLinkTypes(issueA: JiraIssue, issueB: JiraIssue): string[] {
  const linkTypes = new Set<string>();

  // Check links from issueA to issueB
  if (issueA.fields.issuelinks) {
    issueA.fields.issuelinks.forEach(link => {
      if (link.outwardIssue && link.outwardIssue.key === issueB.key) {
        linkTypes.add(link.type.name);
      }
      if (link.inwardIssue && link.inwardIssue.key === issueB.key) {
        linkTypes.add(link.type.name);
      }
    });
  }

  // Check links from issueB to issueA
  if (issueB.fields.issuelinks) {
    issueB.fields.issuelinks.forEach(link => {
      if (link.outwardIssue && link.outwardIssue.key === issueA.key) {
        linkTypes.add(link.type.name);
      }
      if (link.inwardIssue && link.inwardIssue.key === issueA.key) {
        linkTypes.add(link.type.name);
      }
    });
  }

  return Array.from(linkTypes);
}
