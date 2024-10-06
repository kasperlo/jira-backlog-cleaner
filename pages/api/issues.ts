// pages/api/issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const jql = 'project = "BG" AND status = "To Do"'; 
    const response = await jira.searchJira(jql);
    res.status(200).json({ issues: response.issues });
  } catch (error: any) {
    console.error('Error fetching Jira issues:', error.response?.data || error);
    res.status(500).json({
      error: error.response?.data?.errorMessages?.[0] || 'Failed to fetch Jira issues',
    });
  }
}
