// app/api/get-issue/route.ts

import { NextResponse } from 'next/server';
import { JiraConfig } from '@/types/types';
import { createJiraClient } from '@/lib/jiraClient';

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
    const issue = await jiraClient.findIssue(issueKey, '', 'summary,description,issuetype,parent,created,subtasks');

    return NextResponse.json({ issue }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error fetching issue:', error);
    return NextResponse.json({ error: 'Failed to fetch issue.' }, { status: 500 });
  }
}
