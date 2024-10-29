// pages/api/delete-issue.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issueKey, action } = req.body;

  if (!issueKey) {
    res.status(400).json({ error: 'Issue key is required.' });
    return;
  }

  try {
    // Fetch the issue details first, including subtasks
    const issue = await jira.findIssue(issueKey, '', 'subtasks');

    if (issue.fields.subtasks.length > 0) {
      // If the issue has subtasks, check the user's action
      if (!action) {
        // If no action was specified, return subtasks and ask user for confirmation
        const subtasks = issue.fields.subtasks.map((subtask: any) => ({
          key: subtask.key,
          summary: subtask.fields.summary,
        }));

        res.status(200).json({
          message: `The issue '${issueKey}' has subtasks. Do you want to delete them or convert them into separate tasks?`,
          subtasks,
        });
        return;
      }

      if (action === 'delete') {
        // User chose to delete the subtasks
        for (const subtask of issue.fields.subtasks) {
          await jira.deleteIssue(subtask.key); // Delete each subtask
        }
      } else if (action === 'convert') {
        // User chose to convert subtasks into separate tasks
        for (const subtask of issue.fields.subtasks) {
          await jira.updateIssue(subtask.key, {
            fields: {
              parent: null, // Remove the parent field, converting to a regular task
            },
          });
        }
      }
    }

    // Now delete the main issue
    await jira.deleteIssue(issueKey);

    res.status(200).json({
      message:
        action === 'delete'
          ? `Issue and subtasks deleted successfully.`
          : `Issue deleted and subtasks converted into separate tasks.`,
    });
  } catch (error) {
    console.error('Error deleting issue:', (error as any)?.response?.data || error);
    res.status(500).json({
      error: (error as any)?.response?.data?.errorMessages?.[0] || 'Failed to delete issue.',
    });
  }
}
