// scripts/generateEmbeddings.ts

import jira from '../lib/jiraClient';
import openai from '../lib/openaiClient';
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

async function generateIssueEmbeddings() {
  try {
    const indexName = 'masterz';
    const indexes = await pinecone.listIndexes();

    // Convert to array of index names to use `includes`
    const indexNames = indexes?.indexes?.map((index) => index.name);

    if (!indexNames?.includes(indexName)) {
      await pinecone.createIndex({
        name: indexName,
        dimension: 1536, // Adjust based on the embedding model used
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws', // Adjust based on your environment, e.g., 'gcp'
            region: 'us-east1', // Replace with your preferred region
          },
        },
      });
      console.log('Waiting for index to be ready...');
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }

    const index = pinecone.index(indexName);

    const jql = 'project = "BG"'; // Adjust as needed
    const response = await jira.searchJira(jql, {
      fields: ['summary', 'description', 'issuetype', 'parent'],
      maxResults: 1000,
    });

    const issues: JiraIssue[] = response.issues;

    const upsertVectors = await Promise.all(
      issues.map(async (issue) => {
        const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
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
        };
      })
    );

    // Directly pass the array of vectors to upsert
    await index.upsert(upsertVectors);

    console.log('Embeddings generated and upserted to Pinecone successfully.');
  } catch (error) {
    console.error('Error generating embeddings:', error);
  }
}

generateIssueEmbeddings();
