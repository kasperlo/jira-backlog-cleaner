// jira-backlog-cleaner/app/api/link-issues/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';

export async function POST(request: Request) {
  try {
    const { sourceIssueKey, targetIssueKeys, config } = await request.json();

    if (
      !config ||
      !config.jiraEmail ||
      !config.jiraApiToken ||
      !config.jiraBaseUrl ||
      !config.projectKey
    ) {
      console.warn('Invalid Jira configuration provided:', config);
      return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
    }

    if (
      !sourceIssueKey ||
      !targetIssueKeys ||
      !Array.isArray(targetIssueKeys) ||
      targetIssueKeys.length < 1
    ) {
      return NextResponse.json(
        { error: 'Source issue key and at least one target issue key are required.' },
        { status: 400 }
      );
    }

    // Initialize Jira client with user-provided config
    const jira = new JiraClient({
      protocol: 'https',
      host: config.jiraBaseUrl.replace(/^https?:\/\//, ''),
      username: config.jiraEmail,
      password: config.jiraApiToken,
      apiVersion: '2',
      strictSSL: true,
    });

    // Create links in batch
    const linkPromises = targetIssueKeys.map((dupKey) =>
      jira.issueLink({
        type: { name: 'Duplicate' },
        inwardIssue: { key: sourceIssueKey },
        outwardIssue: { key: dupKey },
      })
    );

    await Promise.all(linkPromises);

    return NextResponse.json(
      {
        message: `Issues ${targetIssueKeys.join(
          ', '
        )} linked as duplicates to ${sourceIssueKey} successfully.`,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to link issues as duplicates.';
    console.error('Error linking issues:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
