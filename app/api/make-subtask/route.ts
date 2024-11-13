// app/api/make-subtask/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';

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

    // Fetch details of parent and original issues
    const parentIssue = await jira.findIssue(parentIssueKey, '', 'summary,project,issuetype');
    const originalIssue = await jira.findIssue(subtaskIssueKey, '', 'summary,project,description,subtasks');

    // Check if parent issue type supports subtasks
    const parentIssueType = parentIssue.fields.issuetype.name;
    const issueTypesThatSupportSubtasks = ['Task', 'Story', 'Bug', 'Epic'];

    if (!issueTypesThatSupportSubtasks.includes(parentIssueType)) {
      return NextResponse.json(
        { error: `The parent issue type '${parentIssueType}' does not support subtasks.` },
        { status: 400 }
      );
    }

    // Fetch create metadata to get the issue type ID for 'Sub-task'
    const projectKey = parentIssue.fields.project.key;
    const createMeta = await jira.getIssueCreateMetadata({
      projectKeys: [projectKey],
      expand: 'projects.issuetypes.fields',
    });

    // Find the issue type ID for 'Sub-task'
    let subtaskIssueTypeId: string | undefined;
    const projectMeta = createMeta.projects.find(
      (proj: any) => proj.key === projectKey
    );

    if (projectMeta) {
      const subtaskIssueType = projectMeta.issuetypes.find(
        (it: any) => it.subtask === true
      );
      if (subtaskIssueType) {
        subtaskIssueTypeId = subtaskIssueType.id;
      }
    }

    if (!subtaskIssueTypeId) {
      return NextResponse.json(
        { error: "Sub-task issue type not found in the project. Ensure that the 'Sub-task' issue type is available in the project's issue type scheme." },
        { status: 400 }
      );
    }

    // Prepare fields for the new subtask
    const newSubtaskData = {
      fields: {
        project: { key: projectKey },
        parent: { key: parentIssueKey },
        summary: originalIssue.fields.summary,
        description: originalIssue.fields.description,
        issuetype: { id: subtaskIssueTypeId },
      },
    };

    // Create the new subtask
    const newSubtask = await jira.addNewIssue(newSubtaskData);

    // Reassign subtasks of the original issue to the new subtask, if any
    if (originalIssue.fields.subtasks && originalIssue.fields.subtasks.length > 0) {
      for (const subtask of originalIssue.fields.subtasks) {
        await jira.updateIssue(subtask.key, {
          fields: {
            parent: {
              key: newSubtask.key,
            },
          },
        });
      }
    }

    // Delete the original issue
    await jira.deleteIssue(subtaskIssueKey);

    return NextResponse.json({
      message: 'Subtask created under the parent issue successfully, and the original issue was deleted.',
      newSubtaskKey: newSubtask.key,
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error while creating subtask.';
    console.error('Error creating subtask:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
