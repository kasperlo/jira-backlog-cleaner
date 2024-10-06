// pages/api/make-subtask.ts

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

  const { parentIssueKey, subtaskIssueKey } = req.body;

  if (!parentIssueKey || !subtaskIssueKey) {
    res.status(400).json({ error: 'Parent issue key and subtask issue key are required.' });
    return;
  }

  try {
    // Ensure the subtask issue is of type "Sub-task"
    const subtaskIssue = await jira.findIssue(subtaskIssueKey);
    if (subtaskIssue.fields.issuetype.name !== 'Sub-task') {
      await jira.updateIssue(subtaskIssueKey, {
        fields: {
          issuetype: {
            name: 'Sub-task',
          },
        },
      });
    }

    // Set the parent of the subtask issue
    await jira.updateIssue(subtaskIssueKey, {
      fields: {
        parent: {
          key: parentIssueKey,
        },
      },
    });

    res.status(200).json({ message: 'Issue converted to subtask successfully.' });
  } catch (error: any) {
    console.error('Error making subtask:', error.response?.data || error);
    res.status(500).json({
      error: error.response?.data?.errorMessages?.[0] || 'Failed to make subtask.',
    });
  }
}
