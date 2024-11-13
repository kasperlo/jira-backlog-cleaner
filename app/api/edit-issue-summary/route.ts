// jira-backlog-cleaner/app/api/edit-issue-summary/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import { validateJiraConfig } from '../../../utils/validateJiraConfig';

interface EditIssueSummaryRequest {
  issueKey: string;
  newSummary: string;
  config: {
    jiraEmail: string;
    jiraApiToken: string;
    jiraBaseUrl: string;
    projectKey: string;
  };
}

interface EditIssueSummaryResponse {
  message: string;
}

export async function POST(request: Request) {
  try {
    const { issueKey, newSummary, config } = await request.json() as EditIssueSummaryRequest;

    // Validate Jira configuration
    const validationError = validateJiraConfig(config);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!issueKey || !newSummary) {
      return NextResponse.json({ error: 'Issue key and new summary are required.' }, { status: 400 });
    }

    const jira = new JiraClient({
      protocol: 'https',
      host: config.jiraBaseUrl.replace(/^https?:\/\//, ''),
      username: config.jiraEmail,
      password: config.jiraApiToken,
      apiVersion: '2',
      strictSSL: true,
    });

    await jira.updateIssue(issueKey, {
      fields: {
        summary: newSummary,
      },
    });
    
    return NextResponse.json({ message: `Issue ${issueKey} summary updated successfully.` }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update issue summary.';
    console.error('Error updating issue summary:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
