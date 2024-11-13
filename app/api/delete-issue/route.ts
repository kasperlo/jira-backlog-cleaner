// jira-backlog-cleaner/app/api/delete-issue/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import { JiraIssue, SubtaskAction } from '@/types/types';

export async function POST(request: Request) {
  try {
    const { issueKey, action, subtaskActions, config } = await request.json();

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
      if (subtaskActions && Array.isArray(subtaskActions) && subtaskActions.length > 0) {
        // Handle individual subtask actions
        for (const subtaskAction of subtaskActions) {
          const { subtaskKey, action: subtaskActionType } = subtaskAction;
          if (subtaskActionType === 'delete') {
            await jira.deleteIssue(subtaskKey);
          } else if (subtaskActionType === 'convert') {
            await jira.updateIssue(subtaskKey, {
              fields: {
                parent: null, // Remove parent to convert to task
                issuetype: { name: 'Task' }, // Or set appropriate issuetype
              },
            });
          } else {
            return NextResponse.json(
              { error: `Invalid action '${subtaskActionType}' for subtask '${subtaskKey}'.` },
              { status: 400 }
            );
          }
        }
      } else if (action === 'delete' || action === 'convert') {
        // Handle action for all subtasks
        for (const subtask of issue.fields.subtasks) {
          if (action === 'delete') {
            await jira.deleteIssue(subtask.key);
          } else if (action === 'convert') {
            await jira.updateIssue(subtask.key, {
              fields: {
                parent: null,
                issuetype: { name: 'Task' },
              },
            });
          }
        }
      } else {
       // If no action specified, return the subtasks and prompt user
          const subtasks = issue.fields.subtasks.map((subtask: JiraIssue) => ({
            key: subtask.key,
            summary: subtask.fields.summary,
          }));

          return NextResponse.json(
            {
              error: `Issue '${issueKey}' has subtasks. Please specify the action to perform on subtasks.`,
              subtasks,
            },
            { status: 400 } // Set the status code to 400 Bad Request
          );
      }
    }

    // Delete the main issue
    await jira.deleteIssue(issueKey);

    return NextResponse.json({
      message: `Issue '${issueKey}' and specified subtasks have been processed successfully.`,
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
