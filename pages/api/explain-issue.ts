// pages/api/explain-issue.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createJiraClient } from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';
import { JiraConfig, JiraIssue } from '../../types/types';
import { fetchAllIssues } from '../../utils/issueProcessor';
import { retryWithExponentialBackoff } from '@/utils/retry';

interface ExplainIssueRequest {
  issueKey: string;
  projectDescription?: string;
  config: JiraConfig;
}

interface ExplainIssueResponse {
  explanation: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExplainIssueResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { issueKey, projectDescription, config } = req.body as ExplainIssueRequest;

  if (!issueKey || !config) {
    return res.status(400).json({ error: 'Issue key and Jira config are required.' });
  }

  const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config;
  if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
    return res.status(400).json({ error: 'Incomplete Jira configuration.' });
  }

  const jiraClient = createJiraClient(config);

  try {
    // Fetch the specific issue to explain with type assertion
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

    res.status(200).json({ explanation });
  } catch (error: unknown) {
    console.error('Error explaining issue:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate issue explanation.',
    });
  }
}
