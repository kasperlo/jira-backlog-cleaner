// jira-backlog-cleaner/app/api/delete-issue/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import { JiraIssue } from '@/types/types';

export async function POST(request: Request) {
  try {
    const { issueKey, action, config } = await request.json();

    // Validate Jira configuration
    if (
      !config ||
      !config.jiraEmail ||
      !config.jiraApiToken ||
      !config.jiraBaseUrl ||
      !config.projectKey
    ) {
      return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
    }

    if (!issueKey) {
      return NextResponse.json({ error: 'Issue key is required.' }, { status: 400 });
    }

    if (action && !['delete', 'convert'].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Allowed actions: 'delete', 'convert'." },
        { status: 400 }
      );
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

    // Fetch issue details
    const issue = await jira.findIssue(issueKey, '', 'subtasks');

    if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
      if (!action) {
        // If no action specified, return the subtasks and prompt user
        const subtasks = issue.fields.subtasks.map((subtask: JiraIssue) => ({
          key: subtask.key,
          summary: subtask.fields.summary,
        }));

        return NextResponse.json({
          message: `Issue '${issueKey}' has subtasks. Please specify the action to perform on subtasks.`,
          subtasks,
        });
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

    return NextResponse.json({
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete Jira issue.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
