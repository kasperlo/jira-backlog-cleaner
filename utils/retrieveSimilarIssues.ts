// utils/retrieveSimilarIssues.ts

import pinecone from '../lib/pineconeClient';

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

export async function retrieveSimilarIssues(queryEmbedding: number[], topK: number = 5): Promise<JiraIssue[]> {
  const index = pinecone.index('masterz');

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  if (!queryResponse.matches) {
    return [];
  }

  return queryResponse.matches.map((match) => ({
    id: String(match.id),
    key: String(match.metadata?.issueKey || ''),
    fields: {
      summary: String(match.metadata?.summary || ''),
      description: String(match.metadata?.description || ''),
      issuetype: {
        name: String(match.metadata?.issuetype || ''),
      },
      parent: match.metadata?.parentKey
        ? { key: String(match.metadata.parentKey) }
        : undefined,
    },
  }));
}
