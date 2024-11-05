// types/types.ts

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    parent?: {
      key: string;
    };
    created: string;
    subtasks?: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        description?: string;
        issuetype: {
          name: string;
        };
        parent?: {
          key: string;
        };
      };
    }>;
    [key: string]: any; // Add any additional fields as necessary
  };
}

export interface Suggestion {
  summary: string;
  description: string;
  issuetype: string;
}

export type ActionType = 'merge' | 'notDuplicate' | 'ignore';

export interface DuplicateGroup {
  group: JiraIssue[];
  explanation: string;
}

export interface ActionSuggestion {
  action: 1 | 2 | 3 | 4;
  description: string;
  keepIssueKey?: string; // Only for Action 1
  deleteIssueKey?: string; // Only for Action 1
  deleteIssueKeys?: string[]; // Only for Action 2
  createIssueSummary?: string; // Only for Action 2
  createIssueDescription?: string; // Only for Action 2
  parentIssueKey?: string; // Only for Action 3
  subtaskIssueKey?: string; // Only for Action 3
}

export interface JiraConfig {
  jiraEmail: string;
  jiraApiToken: string;
  jiraBaseUrl: string;
  projectKey: string;
}

export interface ProgressData {
  total: number;
  completed: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}
