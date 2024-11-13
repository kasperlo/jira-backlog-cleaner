// jira-backlog-cleaner/app/api/validate-jira-config/route.ts

import { NextResponse } from 'next/server';
import { JiraConfig } from '../../../types/types';
import { validateJiraConfig } from '../../../utils/validateJiraConfig';

interface ValidateJiraConfigResponse {
  success: boolean;
  message: string;
}

export async function POST(request: Request) {
  try {
    const { config } = await request.json() as { config: JiraConfig };

    const validationError = validateJiraConfig(config);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }

    // Attempt to fetch the project to validate the configuration
    return NextResponse.json({ success: true, message: `Project '${config.projectKey}' found.` }, { status: 200 });
  } catch (error: unknown) {
    console.error('Jira Validation Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to validate Jira configuration.';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}
