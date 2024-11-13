// jira-backlog-cleaner/app/api/make-subtask/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import { ProjectMeta } from '@/types/types';

export async function POST(request: Request) {
  try {
    const { parentIssueKey, subtaskIssueKey, config } = await request.json();

    if (!config || !config.jiraEmail || !config.jiraApiToken || !config.jiraBaseUrl || !config.projectKey) {
      console.warn('Invalid Jira configuration provided:', config);
      return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
    }

    if (!parentIssueKey || !subtaskIssueKey) {
      return NextResponse.json(
        { error: 'Parent issue key and subtask issue key are required.' },
        { status: 400 }
      );
    }

    // Initialize Jira client with user-provided config
    const jira = new JiraClient({
      protocol: 'https',
      host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
      username: config.jiraEmail,
      password: config.jiraApiToken,
      apiVersion: '2',
      strictSSL: true,
    });

    // Fetch details of parent and subtask issues
    const parentIssue = await jira.findIssue(parentIssueKey, '', 'summary,project,issuetype');
    const subtaskIssue = await jira.findIssue(subtaskIssueKey, '', 'summary,project,description');

    // Ensure the parent and subtask are in the same project
    if (parentIssue.fields.project.key !== subtaskIssue.fields.project.key) {
      return NextResponse.json(
        { error: 'The parent issue and subtask issue must be in the same project.' },
        { status: 400 }
      );
    }

    // Check if parent issue type supports subtasks
    const parentIssueType = parentIssue.fields.issuetype.name;
    const issueTypesThatSupportSubtasks = ['Task', 'Story', 'Bug', 'Epic'];

    if (!issueTypesThatSupportSubtasks.includes(parentIssueType)) {
      return NextResponse.json(
        { error: `The parent issue type '${parentIssueType}' does not support subtasks.` },
        { status: 400 }
      );
    }

    // Fetch create metadata to get the issue type ID for 'Sub-task' or 'Deloppgave'
    const projectKey = parentIssue.fields.project.key;
    const createMeta = await jira.getIssueCreateMetadata({
      projectKeys: [projectKey],
      expand: 'projects.issuetypes.fields',
    });

    console.log('Create Metadata:', JSON.stringify(createMeta, null, 2));

    // Find the issue type ID for 'Sub-task' or 'Deloppgave'
    let subtaskIssueTypeId: string | undefined;
    const projectMeta = (createMeta.projects as ProjectMeta[]).find(
      (proj) => proj.key === projectKey
    );

    if (projectMeta) {
      const subtaskIssueType = projectMeta.issuetypes.find(
        (it) =>
          it.name.toLowerCase() === 'sub-task' ||
          it.name.toLowerCase() === 'deloppgave'
      );
      if (subtaskIssueType) {
        subtaskIssueTypeId = subtaskIssueType.id;
      }
    }

    if (!subtaskIssueTypeId) {
      return NextResponse.json(
        { error: "Neither 'Sub-task' nor 'Deloppgave' issue type found in the project. Ensure that the correct issue type is available in the project's issue type scheme." },
        { status: 400 }
      );
    }

    // Create a new subtask under the parent issue
    const newSubtask = await jira.addNewIssue({
      fields: {
        project: {
          key: projectKey,
        },
        parent: {
          key: parentIssueKey,
        },
        summary: subtaskIssue.fields.summary,
        description: subtaskIssue.fields.description || '',
        issuetype: {
          id: subtaskIssueTypeId,
        },
      },
    });

    // Delete the original issue if subtask creation is successful
    await jira.deleteIssue(subtaskIssueKey);

    return NextResponse.json({
      message: 'Issue converted to subtask successfully.',
      newSubtaskKey: newSubtask.key,
    }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error while promoting to Epic.';
    console.error('Error converting issue to subtask:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
