// pages/api/update-issue-type.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createJiraClient, JiraConfig } from '../../lib/jiraClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { issueKey, newIssueType, config } = req.body;

  if (!issueKey || !newIssueType || !config) {
    return res.status(400).json({ error: 'Issue key, new issue type, and Jira config are required.' });
  }

  // Validate JiraConfig structure (optional but recommended)
  const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config as JiraConfig;
  if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
    return res.status(400).json({ error: 'Incomplete Jira configuration.' });
  }

  // Instantiate JiraClient with the provided config
  const jiraClient = createJiraClient(config as JiraConfig);

  try {
    // Update the issue type
    await jiraClient.updateIssue(issueKey, {
      fields: {
        issuetype: {
          name: newIssueType,
        },
      },
    });

    res.status(200).json({ message: 'Issue type updated successfully.' });
  } catch (error: any) {
    console.error('Error updating issue type:', error.response?.data || error);
    res.status(500).json({
      error: error.response?.data?.errorMessages?.[0] || 'Failed to update issue type.',
    });
  }
}
