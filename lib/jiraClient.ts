// lib/jiraClient.ts

import JiraClient from 'jira-client';

export interface JiraConfig {
  jiraEmail: string;
  jiraApiToken: string;
  jiraBaseUrl: string;
  projectKey: string;
}

export const createJiraClient = (config: JiraConfig) => {
  return new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });
};

