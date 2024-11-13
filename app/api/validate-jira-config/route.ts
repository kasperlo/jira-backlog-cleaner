// jira-backlog-cleaner/app/api/validate-jira-config/route.ts

import { NextResponse } from 'next/server';
import { JiraConfig } from '../../../types/types';
import { createJiraClient } from '../../../lib/jiraClient';
import { validateJiraConfig } from '@/utils/validateJiraConfig';

export async function POST(request: Request) {
  try {
    const { config } = (await request.json()) as { config: JiraConfig };

    // Validate JiraConfig structure (existing code)
    const validationError = validateJiraConfig(config);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }

    // Instantiate JiraClient with the provided config
    const jiraClient = createJiraClient(config);

    // Fetch the project details to validate the configuration and get the project title
    const project = await jiraClient.getProject(config.projectKey);

    if (!project) {
      return NextResponse.json(
        { success: false, message: `Project '${config.projectKey}' not found.` },
        { status: 404 }
      );
    }

    // Return the project title along with success response
    return NextResponse.json(
      { success: true, projectTitle: project.name, message: `Project '${project.name}' found.` },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Jira Validation Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to validate Jira configuration.';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}
