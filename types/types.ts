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
    status?: {
      name: string;
    };
    priority?: {
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
    embedding?: number[];
    similarity?: number;
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
  similarityScore: number;
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

export interface ErrorResponse {
  errors?: Record<string, string>; // Assuming `errors` is an object with string keys and values
  errorMessages?: string[];
}

export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: {
    issueKey: string;
    summary: string;
    description?: string;
    issueType: string; // Ensure this matches the key used in metadata
    parentKey?: string;
  };
}

export interface SuggestedIssue {
  summary: string;
  description: string;
  issueType: 'Story' | 'Task' | 'Subtask';
  explanation: string;
}

export interface RecordMetadata {
  issueKey?: string;
  summary?: string;
  description?: string;
  issueType?: string;
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
  id: string;
  key: string;
  fields: {
      summary: string;
      description?: string;
      issuetype: {
          name: string;
      };
      // Add other fields if necessary
  };
}


export interface SubtaskAction {
  subtaskKey: string;
  action: 'delete' | 'convert';
}

export interface SubtaskInput {
  id: number;
  title: string;
  isConfirmed: boolean;
}