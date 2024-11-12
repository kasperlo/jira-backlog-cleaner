// pages/api/link-issue-to-epic.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createJiraClient } from '../../../lib/jiraClient';
import { JiraConfig } from '../../../types/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { issueKey, epicKey, config } = req.body;

  if (!issueKey || !epicKey || !config) {
    res.status(400).json({ error: 'Issue key, epic key, and Jira config are required.' });
    return;
  }

  // Validate JiraConfig structure
  const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config as JiraConfig;
  if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
    return res.status(400).json({ error: 'Incomplete Jira configuration.' });
  }

  // Instantiate JiraClient with the provided config
  const jiraClient = createJiraClient(config as JiraConfig);

  try {
    console.log(`Linking issue ${issueKey} to epic ${epicKey}`);

    // Verify that the epic exists and is of type 'Epic'
    const epicIssue = await jiraClient.findIssue(epicKey, 'issuetype');
    console.log(`Fetched epic issue: ${epicKey}`, epicIssue);

    if (epicIssue.fields.issuetype.name !== 'Epic') {
      res.status(400).json({ error: `${epicKey} is not an Epic.` });
      return;
    }

    // Determine the correct field for 'Epic Link'
    const fields = await jiraClient.listFields();
    const epicLinkField = fields.find((field) => field.name === 'Epic Link');

    if (!epicLinkField) {
      console.error(`'Epic Link' field not found in Jira.`);
      res.status(500).json({ error: `'Epic Link' field not found in Jira.` });
      return;
    }

    console.log(`Epic Link Field ID: ${epicLinkField.id}`);

    // Update the 'Epic Link' field on the issue
    await jiraClient.updateIssue(issueKey, {
      fields: {
        [epicLinkField.id]: epicKey,
      },
    });

    console.log(`Issue ${issueKey} linked to Epic ${epicKey} successfully.`);

    res
      .status(200)
      .json({ message: `Issue ${issueKey} linked to Epic ${epicKey} successfully.` });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Failed to link issue ${issueKey} to epic ${epicKey}.`;
    console.error(
      `Error linking issue ${issueKey} to epic ${epicKey}:`,
      error instanceof Error ? error.message : error
    );
    res.status(500).json({
      error: errorMessage,
    });
  }
}
