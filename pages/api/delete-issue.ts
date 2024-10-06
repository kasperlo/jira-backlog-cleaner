// pages/api/delete-issue.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issueKey } = req.body;

  if (!issueKey) {
    res.status(400).json({ error: 'Issue key is required.' });
    return;
  }

  try {
    await jira.deleteIssue(issueKey);
    res.status(200).json({ message: 'Issue deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting issue:', error.response?.data || error);
    res.status(500).json({
      error: 'Failed to delete issue.',
    });
  }
}
