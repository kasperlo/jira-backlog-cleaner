// pages/api/delete-issue.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import JiraClient from 'jira-client';
import { JiraIssue } from '@/types/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { issueKey, action, config } = req.body;

  // Validate Jira configuration
  if (
    !config ||
    !config.jiraEmail ||
    !config.jiraApiToken ||
    !config.jiraBaseUrl ||
    !config.projectKey
  ) {
    res.status(400).json({ error: 'Invalid Jira configuration provided.' });
    return;
  }

  if (!issueKey) {
    res.status(400).json({ error: 'Issue key is required.' });
    return;
  }

  if (action && !['delete', 'convert'].includes(action)) {
    res.status(400).json({ error: "Invalid action. Allowed actions: 'delete', 'convert'." });
    return;
  }

  // Initialize Jira client with user-provided configuration
  const jira = new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });

  try {
    // Fetch issue details
    const issue = await jira.findIssue(issueKey, '', 'subtasks');

    if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
      if (!action) {
        // If no action specified, return the subtasks and prompt user
        const subtasks = issue.fields.subtasks.map((subtask: JiraIssue) => ({
          key: subtask.key,
          summary: subtask.fields.summary,
        }));

        res.status(200).json({
          message: `Issue '${issueKey}' has subtasks. Please specify the action to perform on subtasks.`,
          subtasks,
        });
        return;
      }

      if (action === 'delete') {
        // Delete all subtasks
        for (const subtask of issue.fields.subtasks) {
          await jira.deleteIssue(subtask.key);
        }
      } else if (action === 'convert') {
        // Convert subtasks to separate tasks
        for (const subtask of issue.fields.subtasks) {
          await jira.updateIssue(subtask.key, {
            fields: {
              parent: null, // Remove parent to convert to task
            },
          });
        }
      }
    }

    // Delete the main issue
    await jira.deleteIssue(issueKey);

    res.status(200).json({
      message:
        action === 'delete'
          ? `Issue '${issueKey}' and its subtasks have been deleted successfully.`
          : action === 'convert'
          ? `Issue '${issueKey}' has been deleted and its subtasks have been converted to separate tasks.`
          : `Issue '${issueKey}' has been deleted successfully.`,
    });
  } catch (error: unknown) {
    console.error(
      'Error deleting Jira issue:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    res.status(500).json({ error: 'Failed to delete Jira issue.' });
  }
}
