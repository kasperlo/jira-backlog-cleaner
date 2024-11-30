// app/api/make-subtask/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import { ErrorResponse, IssueType, ProjectMeta } from '@/types/types';

export async function POST(request: Request) {
  try {
    const { parentIssueKey, subtaskIssueKey, config } = await request.json();

    // Validate Jira configuration
    if (
      !config ||
      !config.jiraEmail ||
      !config.jiraApiToken ||
      !config.jiraBaseUrl ||
      !config.projectKey
    ) {
      console.warn('Invalid Jira configuration provided:', config);
      return NextResponse.json(
        { error: 'Invalid Jira configuration provided.' },
        { status: 400 }
      );
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
    const parentIssue = await jira.findIssue(
      parentIssueKey,
      '',
      'summary,project,issuetype'
    );
    const originalIssue = await jira.findIssue(
      subtaskIssueKey,
      '',
      'summary,project,description,subtasks'
    );

    // Fetch create metadata to get the issue type hierarchy
    const projectKey = parentIssue.fields.project.key;
    console.log('Project Key:', projectKey); // Log projectKey for debugging

    const createMeta = await jira.getIssueCreateMetadata({
      projectKeys: [projectKey],
      expand: 'projects.issuetypes.fields',
    });

    // Find the project metadata
    const projectMeta = createMeta.projects.find(
      (proj: ProjectMeta) => proj.key === projectKey
    );

    if (!projectMeta) {
      return NextResponse.json(
        { error: `Project metadata not found for project key: ${projectKey}` },
        { status: 400 }
      );
    }

    // Identify subtask issue types
    const subtaskIssueTypes = projectMeta.issuetypes.filter(
      (it: IssueType) => it.subtask === true
    );

    if (subtaskIssueTypes.length === 0) {
      return NextResponse.json(
        { error: 'No subtask issue types available in this project.' },
        { status: 400 }
      );
    }

    // Get the subtask issue type ID
    const subtaskIssueTypeId = subtaskIssueTypes[0].id;
    console.log('Subtask Issue Type ID:', subtaskIssueTypeId); // Log for debugging

    // Check if the parent issue type supports subtasks
    const parentIssueTypeId = parentIssue.fields.issuetype.id;

    // Identify standard issue types (non-subtask types)
    const standardIssueTypes = projectMeta.issuetypes.filter(
      (it: IssueType) => it.subtask === false
    );

    const parentIssueType = standardIssueTypes.find(
      (it: IssueType) => it.id === parentIssueTypeId
    );

    if (!parentIssueType) {
      return NextResponse.json(
        {
          error: `The parent issue type '${parentIssue.fields.issuetype.name}' does not support subtasks.`,
        },
        { status: 400 }
      );
    }

    // Prepare fields for the new subtask
    const newSubtaskData = {
      fields: {
        project: { key: projectKey }, // Include project field
        parent: { key: parentIssueKey },
        summary: originalIssue.fields.summary,
        description: originalIssue.fields.description,
        issuetype: { id: subtaskIssueTypeId },
      },
    };

    console.log('New Subtask Data:', JSON.stringify(newSubtaskData, null, 2)); // Log data for debugging

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

    return NextResponse.json(
      {
        message:
          'Subtask created under the parent issue successfully, and the original issue was deleted.',
        newSubtaskKey: newSubtask.key,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error creating subtask:', error);

    let errorMessage = 'Internal server error while creating subtask.';
    if (error instanceof Error && typeof error === 'object' && 'response' in error) {
      const responseData = (error.response as { data?: ErrorResponse }).data;

      if (responseData?.errors) {
        errorMessage = Object.values(responseData.errors).join(', ');
      } else if (responseData?.errorMessages?.length) {
        errorMessage = responseData.errorMessages.join(', ');
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
