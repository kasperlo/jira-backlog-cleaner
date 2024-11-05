// utils/validateJiraConfig.ts

import { JiraConfig } from '../types/types';

export function validateJiraConfig(config: JiraConfig): string | null {
  if (!config) return 'Jira configuration is missing.';
  const { jiraEmail, jiraApiToken, jiraBaseUrl, projectKey } = config;
  if (!jiraEmail || !jiraApiToken || !jiraBaseUrl || !projectKey) {
    return 'Incomplete Jira configuration.';
  }
  return null;
}
