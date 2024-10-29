import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';
import pinecone from '../../lib/pineconeClient';
import { Index } from '@pinecone-database/pinecone';

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

interface DuplicateGroup {
  group: JiraIssue[];
  explanation: string;
}

interface FetchResponse {
  records: {
    [id: string]: {
      id: string;
      values: number[];
      sparseValues?: any;
      metadata?: Record<string, any>;
    };
  };
  namespace?: string;
  usage?: {
    readUnits?: number;
  };
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Fetch issues from Jira
    const jql = 'project = "BG"';
    const response = await jira.searchJira(jql, {
      fields: ['summary', 'description', 'issuetype', 'parent'],
    });
    const issues: JiraIssue[] = response.issues;

    // Detect duplicates using Pinecone
    const duplicates = await detectDuplicatesWithPinecone(issues);

    res.status(200).json({ duplicates });
  } catch (error: any) {
    console.error('Error detecting duplicates:', error);
    res.status(500).json({
      error:
        error.response?.data?.errorMessages?.[0] || 'Failed to detect duplicates',
    });
  }
}

async function detectDuplicatesWithPinecone(issues: JiraIssue[]): Promise<DuplicateGroup[]> {
  const index = pinecone.Index('masterz'); // Use your index name

  const duplicateGroups: DuplicateGroup[] = [];
  const processedIssues = new Set<string>();
  const SIMILARITY_THRESHOLD = 0.9; // Adjust based on your needs

  for (const issue of issues) {
    if (processedIssues.has(issue.key)) continue;

    // Fetch the issue's embedding
    const fetchResponse = (await index.fetch([issue.key])) as FetchResponse;
    console.log('fetchResponse:', fetchResponse);

    const vector = fetchResponse.records[issue.key]; // Access 'records' instead of 'vectors'

    if (!vector) {
      console.error(`Embedding not found for issue ${issue.key}`);
      continue;
    }

    const embedding = vector.values;

    // Perform similarity search
    const queryResponse = await index.query({
      vector: embedding,
      topK: 10, // Number of similar issues to retrieve
      includeMetadata: true,
      includeValues: false,
    });

    const similarIssues = queryResponse.matches
      .filter(
        (match) =>
          match.id !== issue.key && match.score !== undefined && match.score >= SIMILARITY_THRESHOLD
      )
      .map((match) => ({
        key: match.id,
        score: match.score!,
      }));

    if (similarIssues.length > 0) {
      const groupIssues = [issue];

      for (const simIssue of similarIssues) {
        const matchedIssue = issues.find((i) => i.key === simIssue.key);
        if (matchedIssue && !processedIssues.has(matchedIssue.key)) {
          groupIssues.push(matchedIssue);
          processedIssues.add(matchedIssue.key);
        }
      }

      duplicateGroups.push({
        group: groupIssues,
        explanation: `Issues are duplicates based on a similarity score above ${SIMILARITY_THRESHOLD}.`,
      });

      groupIssues.forEach((i) => processedIssues.add(i.key));
    } else {
      processedIssues.add(issue.key);
    }
  }

  return duplicateGroups;
}
