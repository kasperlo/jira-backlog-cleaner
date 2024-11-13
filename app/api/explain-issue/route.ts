// jira-backlog-cleaner/app/api/explain-issue/route.ts

import { NextResponse } from 'next/server';
import { createJiraClient } from '../../../lib/jiraClient';
import openai from '../../../lib/openaiClient';
import { JiraConfig, JiraIssue } from '../../../types/types';
import { fetchAllIssues } from '../../../utils/issueProcessor';
import { retryWithExponentialBackoff } from '@/utils/retry';

interface ExplainIssueRequest {
  issueKey: string;
  projectDescription?: string;
  config: JiraConfig;
}

interface ExplainIssueResponse {
  explanation: string;
}

export async function POST(request: Request) {
  try {
    const { issueKey, projectDescription, config } = await request.json() as ExplainIssueRequest;

    if (!issueKey || !config) {
      return NextResponse.json({ error: 'Issue key and Jira config are required.' }, { status: 400 });
    }

    const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config;
    if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
      return NextResponse.json({ error: 'Incomplete Jira configuration.' }, { status: 400 });
    }

    const jiraClient = createJiraClient(config);

    // Fetch the specific issue to explain
    const issueResponse = await jiraClient.findIssue(issueKey, '', 'summary,description');
    const issue: JiraIssue = issueResponse as JiraIssue;

    // Fetch all issues for context
    const allIssues: JiraIssue[] = await fetchAllIssues(config);

    // Exclude the target issue from the context
    const otherIssues = allIssues.filter((iss) => iss.key !== issueKey);

    // Construct summaries of all other issues
    const issueSummaries = otherIssues
      .map((iss) => `Issue ${iss.key}: ${iss.fields.summary}`)
      .join('\n');

    // Construct the prompt
    const prompt = `
You are a project management assistant. Provide a concise and simple explanation for the following issue in the context of the project and all other issues.

I am confused about the target issue and what it really means. What is the real task, and why is it important (if it is important) within this project. 

Please explain it to me in simple terms, using a maximum of 5 sentences (preferably less if possible).

### Project Description:
${projectDescription || 'No project description provided.'}

### All Issues:
${issueSummaries || 'No other issues available.'}

### Target Issue:
Issue ${issue.key}: ${issue.fields.summary}
Description: ${issue.fields.description || 'No description provided.'}

### Explanation:
`;

    // Call OpenAI's GPT-4 API
    const response = await retryWithExponentialBackoff(() =>
      openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      })
    );

    const explanation = response.choices[0]?.message?.content?.trim();

    if (!explanation) {
      throw new Error('No explanation received from OpenAI.');
    }

    return NextResponse.json({ explanation }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error explaining issue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate issue explanation.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
