// app/api/create-subtask/route.ts

import { NextResponse } from 'next/server';
import JiraClient from 'jira-client';
import { validateJiraConfig } from '../../../utils/validateJiraConfig';
import { IssueType, ProjectMeta } from '@/types/types';

interface CreateSubtaskRequest {
  parentIssueKey: string;
  summary: string;
  config: {
    jiraEmail: string;
    jiraApiToken: string;
    jiraBaseUrl: string;
    projectKey: string;
  };
}

export async function POST(request: Request) {
  try {
    const { parentIssueKey, summary, config } = (await request.json()) as CreateSubtaskRequest;

    // Validate Jira configuration
    const validationError = validateJiraConfig(config);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!parentIssueKey || !summary) {
      return NextResponse.json({ error: 'Parent issue key and subtask summary are required.' }, { status: 400 });
    }

    const jira = new JiraClient({
      protocol: 'https',
      host: config.jiraBaseUrl.replace(/^https?:\/\//, ''),
      username: config.jiraEmail,
      password: config.jiraApiToken,
      apiVersion: '2',
      strictSSL: true,
    });

    // Fetch parent issue to get project key
    const parentIssue = await jira.findIssue(parentIssueKey);
    const projectKey = parentIssue.fields.project.key;

    // Fetch create metadata to get the issue type ID for 'Sub-task'
    const createMeta = await jira.getIssueCreateMetadata({
      projectKeys: [projectKey],
      expand: 'projects.issuetypes.fields',
    });

    // Find the issue type ID for 'Sub-task'
    let subtaskIssueTypeId: string | undefined;
    const projectMeta = createMeta.projects.find((proj: ProjectMeta) => proj.key === projectKey);

    if (projectMeta) {
      const subtaskIssueType = projectMeta.issuetypes.find((it: IssueType) => it.name.toLowerCase() === "subtask" || "sub-task" || "deloppgave");
      if (subtaskIssueType) {
        subtaskIssueTypeId = subtaskIssueType.id;
      }
    }

    if (!subtaskIssueTypeId) {
      return NextResponse.json(
        {
          error:
            "Sub-task issue type not found in the project. Ensure that the 'Sub-task' issue type is available in the project's issue type scheme.",
        },
        { status: 400 }
      );
    }

    // Prepare fields for the new subtask
    const newSubtaskData = {
      fields: {
        project: { key: projectKey },
        parent: { key: parentIssueKey },
        summary: summary,
        issuetype: { id: subtaskIssueTypeId },
      },
    };

    // Create the new subtask
    const newSubtask = await jira.addNewIssue(newSubtaskData);

    // Fetch the full subtask details to get the 'fields' property
    const fullSubtask = await jira.findIssue(newSubtask.key);

    return NextResponse.json(
      {
        message: 'Subtask created successfully.',
        subtask: fullSubtask,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error while creating subtask.';
    console.error('Error creating subtask:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
