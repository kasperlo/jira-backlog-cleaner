// pages/api/promote-to-epic.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * API Handler for Promoting a Jira Issue to an Epic.
 * @param req - NextApiRequest
 * @param res - NextApiResponse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    console.warn(`Method ${req.method} not allowed on /api/promote-to-epic`);
    return;
  }

  const { issueKey } = req.body;

  // Validate the request body
  if (!issueKey || typeof issueKey !== 'string') {
    res.status(400).json({ error: 'Invalid or missing issueKey.' });
    console.warn('Invalid or missing issueKey:', issueKey);
    return;
  }

  // Jira API credentials and configuration
  const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
  const JIRA_EMAIL = process.env.JIRA_EMAIL;

  // Temporary Logging for Verification
  console.log('JIRA_BASE_URL:', JIRA_BASE_URL); // Should log: https://anita-kildemo-flor.atlassian.net
  console.log('JIRA_EMAIL:', JIRA_EMAIL); // Should log your email

  if (!JIRA_BASE_URL || !JIRA_API_TOKEN || !JIRA_EMAIL) {
    res.status(500).json({ error: 'Jira configuration is missing.' });
    console.error('Jira configuration is missing.');
    return;
  }

  try {
    // Fetch the current issue details
    const issueResponse = await axios.get(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
        'Accept': 'application/json',
      },
    });

    const issue = issueResponse.data;

    // Check if the issue is already an Epic
    if (issue.fields.issuetype.name === 'Epic') {
      res.status(400).json({ error: `Issue ${issueKey} is already an Epic.` });
      console.warn(`Issue ${issueKey} is already an Epic.`);
      return;
    }

    // Promote the issue to Epic by updating its issuetype
    const updateResponse = await axios.put(
      `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`,
      {
        fields: {
          issuetype: {
            name: 'Epic',
          },
          // Additional fields can be updated here if necessary
        },
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (updateResponse.status === 204) {
      res.status(200).json({ message: `Issue ${issueKey} has been promoted to an Epic successfully.` });
      console.log(`Issue ${issueKey} promoted to Epic successfully.`);
    } else {
      res.status(updateResponse.status).json({ error: `Failed to promote issue ${issueKey} to Epic.` });
      console.error(`Failed to promote issue ${issueKey} to Epic. Status: ${updateResponse.status}`);
    }
  } catch (error: any) {
    // Handle errors from Jira API
    if (error.response) {
      const { status, data } = error.response;
      res.status(status).json({ error: data.errorMessages?.[0] || data.message || 'Unknown error from Jira API.' });
      console.error(`Jira API Error: ${status} - ${data.errorMessages?.[0] || data.message}`);
    } else {
      res.status(500).json({ error: 'Internal server error while promoting to Epic.' });
      console.error('Internal server error while promoting to Epic:', error.message);
    }
  }
}
