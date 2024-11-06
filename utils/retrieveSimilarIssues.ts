// utils/retrieveSimilarIssues.ts

import { JiraIssue, RecordMetadata } from '@/types/types';
import pinecone from '../lib/pineconeClient';

export async function retrieveSimilarIssues(queryEmbedding: number[], topK: number = 10): Promise<JiraIssue[]> {
  const index = pinecone.Index('masterz-3072');

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    includeValues: false, // Set to true if you need the embeddings
  });

  if (!queryResponse.matches) {
    return [];
  }

  return queryResponse.matches.map((match) => {
    const metadata = match.metadata as RecordMetadata;

    // Remove embedding handling from metadata
    // If you need the embeddings, get them from match.values
    let embedding: number[] | undefined = match.values;

    // Handle subtasks
    let subtasks: JiraIssue['fields']['subtasks'] | undefined;
    if (Array.isArray(metadata.subtasks)) {
      subtasks = metadata.subtasks.map((subtask) => ({
        id: String(subtask.id),
        key: String(subtask.key),
        fields: {
          summary: String(subtask.summary || ''),
          description: String(subtask.description || ''),
          issuetype: {
            name: String(subtask.issuetype || ''),
          },
        },
      }));
    }

    return {
      id: String(match.id),
      key: String(metadata.issueKey || ''),
      fields: {
        summary: String(metadata.summary || ''),
        description: String(metadata.description || ''),
        issuetype: {
          name: String(metadata.issuetype || ''),
        },
        parent: metadata.parentKey ? { key: String(metadata.parentKey) } : undefined,
        created: String(metadata.created || new Date().toISOString()),
        subtasks,
        // If embeddings are needed, include them here
        // embedding,
        similarity: typeof match.score === 'number' ? match.score : undefined,
      },
    };
  });
}
