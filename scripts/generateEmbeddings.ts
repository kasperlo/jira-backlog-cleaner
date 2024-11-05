// scripts/generateEmbeddings.ts

import { createJiraClient, JiraConfig } from '../lib/jiraClient';
import openai from '../lib/openaiClient';
import pineconeClient from '../lib/pineconeClient'; // Assuming you have a named export

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

interface PineconeVector {
  id: string;
  values: number[];
  metadata?: {
    [key: string]: any;
  };
}

async function generateIssueEmbeddings() {
  try {
    const indexName = 'masterz-3072'; // Updated index name
    const indexes = await pineconeClient.listIndexes();

    // Convert to array of index names to use `includes`
    const indexNames = indexes?.indexes?.map((index) => index.name);

    if (!indexNames?.includes(indexName)) {
      await pineconeClient.createIndex({
        name: indexName,
        dimension: 3072, // Updated dimension for text-embedding-3-large
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws', // Adjust based on your environment, e.g., 'gcp'
            region: 'us-east1', // Replace with your preferred region
          },
        },
      });
      console.log('Waiting for index to be ready...');
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds for index creation
    }

    const index = pineconeClient.index(indexName);

    // Replace with your Jira config
    const config: JiraConfig = {
      jiraEmail: 'your-email@example.com',
      jiraApiToken: 'your-api-token',
      jiraBaseUrl: 'https://your-domain.atlassian.net',
      projectKey: 'BG',
    };

    const jiraClient = createJiraClient(config);

    const jql = `project = "${config.projectKey}"`; // Adjust as needed
    const response = await jiraClient.searchJira(jql, {
      fields: ['summary', 'description', 'issuetype', 'parent'],
      maxResults: 1000,
    });

    const issues: JiraIssue[] = response.issues;

    const upsertVectors = await Promise.all(
      issues.map(async (issue) => {
        // Log fetching the issue
        console.log(`fetched ${issue.key} from jira`);

        const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large', // Updated model
          input: text,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // Log embedding creation
        console.log(`created vector embedding for ${issue.key} in pinecone`);

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

    // Batch upsert vectors to Pinecone
    const BATCH_SIZE = 100;
    for (let i = 0; i < upsertVectors.length; i += BATCH_SIZE) {
      const batch = upsertVectors.slice(i, i + BATCH_SIZE);
      await index.upsert(batch);
      console.log(`Upserted batch ${i / BATCH_SIZE + 1} to pinecone`);
      
      // Log each upserted issue
      batch.forEach((vector) => {
        console.log(`updated vector embedding for ${vector.id} in pinecone`);
      });
    }

    console.log('Embeddings generated and upserted to Pinecone successfully.');
  } catch (error: any) {
    console.error('Error generating embeddings:', error.response?.data || error);
  }
}

generateIssueEmbeddings();
