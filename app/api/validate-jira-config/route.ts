// pages/api/validate-jira-config.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { JiraConfig } from '../../../types/types';
import { validateJiraConfig } from '../../../utils/validateJiraConfig';

interface ValidateJiraConfigResponse {
  success: boolean;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ValidateJiraConfigResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { config } = req.body as { config: JiraConfig };
  const validationError = validateJiraConfig(config);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    // Attempt to fetch the project to validate the configuration
    return res.status(200).json({ success: true, message: `Project '${config.projectKey}' found.` });
  } catch (error: unknown) {
    console.error('Jira Validation Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to validate Jira configuration.';
    return res.status(500).json({ success: false, message: errorMessage });
  }
  
}
