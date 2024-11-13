// utils/issueProcessor.ts

import { JiraConfig, JiraIssue, PineconeVector } from '../types/types';
import { createJiraClient } from '../lib/jiraClient';
import openai from '../lib/openaiClient';
import pinecone from '../lib/pineconeClient';
import { OPENAI_EMBEDDING_MODEL, PINECONE_INDEX_NAME } from '@/config';

export async function fetchAllIssues(config: JiraConfig): Promise<JiraIssue[]> {
  const jiraClient = createJiraClient(config);
  const jql = `project = "${config.projectKey}" ORDER BY created DESC`;
  const maxResults = 100;
  let startAt = 0;
  let total = 0;
  let allIssues: JiraIssue[] = [];

  do {
    const response = await jiraClient.searchJira(jql, {
      fields: ['summary', 'description', 'issuetype', 'parent', 'created', 'subtasks'],
      maxResults,
      startAt,
    });
    const fetchedIssues: JiraIssue[] = response.issues;
    allIssues = allIssues.concat(fetchedIssues);
    total = response.total;
    startAt += maxResults;
  } while (allIssues.length < total);

  return allIssues;
}

export async function generateEmbeddings(issues: JiraIssue[]): Promise<PineconeVector[]> {
  const embeddings = await Promise.all(
    issues.map(async (issue) => {
      const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;
      const embeddingResponse = await openai.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: text,
      });
      const embedding = embeddingResponse.data[0].embedding;
      return {
        id: issue.key,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description || '',
          issuetype: issue.fields.issuetype.name,
          parentKey: issue.fields.parent?.key || '',
        },
      } as PineconeVector;
    })
  );
  return embeddings;
}

export async function upsertEmbeddingsToPinecone(vectors: PineconeVector[]) {
  const index = pinecone.Index(PINECONE_INDEX_NAME);
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsert(batch); // Pass the batch array directly
    console.log(`Upserted batch ${i / BATCH_SIZE + 1} to Pinecone`);
  }
}
