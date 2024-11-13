// jira-backlog-cleaner/app/api/link-issue-to-epic/route.ts

import { NextResponse } from 'next/server';
import { createJiraClient } from '../../../lib/jiraClient';
import { JiraConfig } from '../../../types/types';

export async function POST(request: Request) {
  let issueKey: string | undefined;
  let epicKey: string | undefined;

  try {
    const { issueKey: reqIssueKey, epicKey: reqEpicKey, config } = await request.json();

    issueKey = reqIssueKey;
    epicKey = reqEpicKey;

    if (!issueKey || !epicKey || !config) {
      return NextResponse.json(
        { error: 'Issue key, epic key, and Jira config are required.' },
        { status: 400 }
      );
    }

    // Validate JiraConfig structure
    const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config as JiraConfig;
    if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
      return NextResponse.json({ error: 'Incomplete Jira configuration.' }, { status: 400 });
    }

    // Instantiate JiraClient with the provided config
    const jiraClient = createJiraClient(config as JiraConfig);

    console.log(`Linking issue ${issueKey} to epic ${epicKey}`);

    // Verify that the epic exists and is of type 'Epic'
    const epicIssue = await jiraClient.findIssue(epicKey, 'issuetype');
    console.log(`Fetched epic issue: ${epicKey}`, epicIssue);

    if (epicIssue.fields.issuetype.name !== 'Epic') {
      return NextResponse.json({ error: `${epicKey} is not an Epic.` }, { status: 400 });
    }

    // Determine the correct field for 'Epic Link'
    const fields = await jiraClient.listFields();
    const epicLinkField = fields.find((field) => field.name === 'Epic Link');

    if (!epicLinkField) {
      console.error(`'Epic Link' field not found in Jira.`);
      return NextResponse.json({ error: `'Epic Link' field not found in Jira.` }, { status: 500 });
    }

    console.log(`Epic Link Field ID: ${epicLinkField.id}`);

    // Update the 'Epic Link' field on the issue
    await jiraClient.updateIssue(issueKey, {
      fields: {
        [epicLinkField.id]: epicKey,
      },
    });

    console.log(`Issue ${issueKey} linked to Epic ${epicKey} successfully.`);

    return NextResponse.json(
      { message: `Issue ${issueKey} linked to Epic ${epicKey} successfully.` },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Failed to link issue ${issueKey} to epic ${epicKey}.`;
    console.error(
      `Error linking issue ${issueKey} to epic ${epicKey}:`,
      errorMessage
    );
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
