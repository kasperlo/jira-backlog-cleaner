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
      };
    }>;
    embedding?: number[]; // Optional embedding field
    similarity?: number;  // Optional similarity score
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

export interface SuggestedIssue {
  summary: string;
  description: string;
  issuetype: 'Story' | 'Task' | 'Sub-task';
  explanation: string;
}

export interface RecordMetadata {
  issueKey?: string;
  summary?: string;
  description?: string;
  issuetype?: string;
  parentKey?: string;
  created?: string;
  subtasks?: Array<{
    id: string;
    key: string;
    summary?: string;
    description?: string;
    issuetype?: string;
  }>;
}

export interface SimilarIssue {
  key: string;
  summary: string;
  issuetype: string;
  similarity: number;
}

export interface IssueData {
  fields: {
    project: { key: string };
    summary: string;
    description: string;
    issuetype: { name: string };
    [key: string]: unknown;
  };
}

export interface IssueType {
  id: string;
  name: string;
}

export interface ProjectMeta {
  key: string;
  issuetypes: IssueType[];
}

export interface Subtask {
  key: string;
  summary: string;
}

export interface SubtaskAction {
  subtaskKey: string;
  action: 'delete' | 'convert';
}
