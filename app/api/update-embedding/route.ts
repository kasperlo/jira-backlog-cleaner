// jira-backlog-cleaner/app/api/update-embedding/route.ts

import { NextResponse } from 'next/server';
import { createJiraClient } from '../../../lib/jiraClient';
import openai from '../../../lib/openaiClient';
import { Pinecone } from '@pinecone-database/pinecone';
import { JiraConfig } from '../../../types/types';
import { retryWithExponentialBackoff } from '@/utils/retry';
import { PINECONE_INDEX_NAME } from '@/config';

const pinecone = new Pinecone();

export async function POST(request: Request) {
  try {
    const { issueKey, config } = await request.json();

    if (!issueKey || !config) {
      return NextResponse.json({ error: 'Issue key and Jira config are required.' }, { status: 400 });
    }

    // Validate JiraConfig structure
    const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config as JiraConfig;
    if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
      return NextResponse.json({ error: 'Incomplete Jira configuration.' }, { status: 400 });
    }

    // Instantiate JiraClient with the provided config
    const jiraClient = createJiraClient(config as JiraConfig);

    // Fetch the issue
    const issue = await jiraClient.findIssue(issueKey, '', 'summary,description,issuetype,parent');
    console.log(`Fetched issue ${issue.key} from Jira`);

    const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;

    const embeddingResponse = await retryWithExponentialBackoff(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
      })
    );
    const embedding = embeddingResponse.data[0].embedding;
    console.log(`Created vector embedding for issue ${issue.key}`);

    const index = pinecone.index(PINECONE_INDEX_NAME);
    await index.upsert([
      {
        id: issueKey,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description || '',
          issuetype: issue.fields.issuetype.name,
          parentKey: issue.fields.parent?.key || '',
        },
      },
    ]);

    console.log(`Updated vector embedding for issue ${issue.key} in Pinecone`);

    return NextResponse.json({ message: 'Embedding updated successfully.' }, { status: 200 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response: {
          data?: {
            errorMessages?: string[];
          };
        };
      };
      console.error('Error updating embedding:', axiosError.response.data || error);
      return NextResponse.json(
        { error: axiosError.response.data?.errorMessages?.[0] || 'Failed to update embedding.' },
        { status: 500 }
      );
    } else if (error instanceof Error) {
      console.error('Error updating embedding:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      console.error('Unknown error:', error);
      return NextResponse.json({ error: 'Failed to update embedding.' }, { status: 500 });
    }
  }
}
