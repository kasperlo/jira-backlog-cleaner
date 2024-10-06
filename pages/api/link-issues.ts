// pages/api/link-issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issueKeys } = req.body;

  if (!issueKeys || !Array.isArray(issueKeys) || issueKeys.length < 2) {
    res.status(400).json({ error: 'Invalid issue keys provided.' });
    return;
  }

  try {
    // Link each issue to the first one as duplicates
    for (let i = 1; i < issueKeys.length; i++) {
        await jira.issueLink({
            type: { name: 'Duplicate' },
            inwardIssue: { key: issueKeys[0] },
            outwardIssue: { key: issueKeys[i] },
        });          
    }

    res.status(200).json({ message: 'Issues linked as duplicates successfully.' });
  } catch (error: any) {
    console.error('Error linking issues:', error.response?.data || error);
    res.status(500).json({
      error:
        error.response?.data?.errorMessages?.[0] || 'Failed to link issues.',
    });
  }
}
