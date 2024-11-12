// pages/api/link-issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import JiraClient from 'jira-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { sourceIssueKey, targetIssueKeys, config } = req.body;

  if (
    !config ||
    !config.jiraEmail ||
    !config.jiraApiToken ||
    !config.jiraBaseUrl ||
    !config.projectKey
  ) {
    console.warn('Invalid Jira configuration provided:', config);
    res.status(400).json({ error: 'Invalid Jira configuration provided.' });
    return;
  }

  if (
    !sourceIssueKey ||
    !targetIssueKeys ||
    !Array.isArray(targetIssueKeys) ||
    targetIssueKeys.length < 1
  ) {
    res
      .status(400)
      .json({ error: 'Source issue key and at least one target issue key are required.' });
    return;
  }

  // Initialize Jira client with user-provided config
  const jira = new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''),
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });

  try {
    // Create links in batch
    const linkPromises = targetIssueKeys.map((dupKey) =>
      jira.issueLink({
        type: { name: 'Duplicate' },
        inwardIssue: { key: sourceIssueKey },
        outwardIssue: { key: dupKey },
      })
    );

    await Promise.all(linkPromises);

    res.status(200).json({
      message: `Issues ${targetIssueKeys.join(
        ', '
      )} linked as duplicates to ${sourceIssueKey} successfully.`,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to link issues as duplicates.';
    console.error('Error linking issues:', errorMessage);
    res.status(500).json({
      error: errorMessage,
    });
  }
}
