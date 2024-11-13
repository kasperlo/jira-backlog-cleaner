// jira-backlog-cleaner/app/api/create-issue/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import openai from '../../../lib/openaiClient';
import pinecone from '../../../lib/pineconeClient';
import { retryWithExponentialBackoff } from '@/utils/retry';
import { IssueData } from '@/types/types';
import { PINECONE_INDEX_NAME } from '@/config';

export async function POST(request: Request) {
  try {
    const { suggestion, isEpic, config } = await request.json();

    if (!config || !config.jiraEmail || !config.jiraApiToken || !config.jiraBaseUrl || !config.projectKey) {
      console.warn('Invalid Jira configuration provided:', config);
      return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
    }

    if (!suggestion || !suggestion.summary || !suggestion.description || !suggestion.issuetype) {
      return NextResponse.json({ error: 'Suggestion with summary, description, and issuetype is required.' }, { status: 400 });
    }

    // Initialize Jira client with user-provided config
    const jira = new JiraClient({
      protocol: 'https',
      host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
      username: config.jiraEmail,
      password: config.jiraApiToken,
      apiVersion: '2',
      strictSSL: true,
    });

    const issueData: IssueData = {
      fields: {
        project: { key: config.projectKey },
        summary: suggestion.summary,
        description: suggestion.description,
        issuetype: { name: isEpic ? 'Epic' : suggestion.issuetype },
      },
    };

    if (isEpic) {
      issueData.fields['Epic Name'] = suggestion.summary;
    }

    const issue = await jira.addNewIssue(issueData);

    // Generate embedding using text-embedding-3-large
    const text = `${suggestion.summary}\n${suggestion.description}`;
    const embeddingResponse = await retryWithExponentialBackoff(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
      })
    );
    const embedding = embeddingResponse.data[0].embedding;

    // Upsert to Pinecone
    const index = pinecone.index(PINECONE_INDEX_NAME);
    await index.upsert([
      {
        id: issue.key,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: suggestion.summary,
          description: suggestion.description,
          issuetype: suggestion.issuetype,
          parentKey: '',
          isEpic: isEpic,
        },
      },
    ]);

    return NextResponse.json({ message: 'Issue created successfully.', issueKey: issue.key }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error creating issue:', error);
    return NextResponse.json({ error: 'Failed to create issue.' }, { status: 500 });
  }
}
