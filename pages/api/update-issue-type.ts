// pages/api/update-issue-type.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issueKey, newIssueType } = req.body;

  if (!issueKey || !newIssueType) {
    res.status(400).json({ error: 'Issue key and new issue type are required.' });
    return;
  }

  try {
    // Update the issue type
    await jira.updateIssue(issueKey, {
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
