// lib/jiraClient.ts

import JiraClient from 'jira-client';

const jira = new JiraClient({
  protocol: 'https',
  host: process.env.JIRA_HOST!,
  username: process.env.JIRA_EMAIL!,
  password: process.env.JIRA_API_TOKEN!,
  apiVersion: '2',
  strictSSL: true,
});

export default jira;
