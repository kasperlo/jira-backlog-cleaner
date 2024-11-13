import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import openai from '../../../lib/openaiClient';
import { JiraConfig, JiraIssue } from '../../../types/types';
import { retryWithExponentialBackoff } from '@/utils/retry';

interface SuggestSummaryRequest {
  issueKey: string;
  projectDescription?: string;
  config: JiraConfig;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { issueKey, projectDescription, config } = body as SuggestSummaryRequest;

    if (!issueKey || !config) {
      return NextResponse.json(
        { error: 'Issue key and Jira config are required.' },
        { status: 400 }
      );
    }

    const { jiraEmail, jiraApiToken, jiraBaseUrl } = config;

    if (!jiraEmail || !jiraApiToken || !jiraBaseUrl) {
      return NextResponse.json({ error: 'Incomplete Jira configuration.' }, { status: 400 });
    }

    const jira = new JiraClient({
      protocol: 'https',
      host: jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
      username: jiraEmail,
      password: jiraApiToken,
      apiVersion: '2',
      strictSSL: true,
    });

    // Fetch the specific issue to suggest a new summary
    const issueResponse = await jira.findIssue(issueKey, '', 'summary,description');
    const issue: JiraIssue = issueResponse as JiraIssue;

    // Construct the prompt for GPT-4
    const prompt = `
    You are an experienced project manager. Suggest a clear, concise, and improved summary for the following Jira issue to better capture its intent and scope.

    ### Project Description:
    ${projectDescription || 'No project description provided.'}

    ### Current Issue Summary:
    ${issue.fields.summary}

    ### Issue Description:
    ${issue.fields.description || 'No description provided.'}

    ### Suggested Summary:
    `;

    // Call OpenAI's GPT-4 API
    const response = await retryWithExponentialBackoff(() =>
      openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.5,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      })
    );

    const suggestedSummary = response.choices[0]?.message?.content?.trim();

    if (!suggestedSummary) {
      throw new Error('No summary suggestion received from OpenAI.');
    }

    return NextResponse.json({ suggestedSummary }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error suggesting new summary:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate suggested summary.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
