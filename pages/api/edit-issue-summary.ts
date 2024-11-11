// pages/api/edit-issue-summary.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import JiraClient from 'jira-client';
import { validateJiraConfig } from '../../utils/validateJiraConfig';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EditIssueSummaryResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { issueKey, newSummary, config } = req.body as EditIssueSummaryRequest;

  // Validate Jira configuration
  const validationError = validateJiraConfig(config);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  if (!issueKey || !newSummary) {
    res.status(400).json({ error: 'Issue key and new summary are required.' });
    return;
  }

  const jira = new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });

  try {
    await jira.updateIssue(issueKey, {
      fields: {
        summary: newSummary,
      },
    });
    res.status(200).json({ message: `Issue ${issueKey} summary updated successfully.` });
  } catch (error: any) {
    console.error('Error updating issue summary:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to update issue summary.' });
  }
}
