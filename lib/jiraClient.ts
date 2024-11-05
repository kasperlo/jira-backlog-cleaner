// lib/jiraClient.ts

import { JiraConfig } from '../types/types';
import JiraClient from 'jira-client';

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

