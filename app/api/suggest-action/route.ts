// jira-backlog-cleaner/app/api/suggest-action/route.ts

import { NextResponse } from 'next/server';
import openai from '../../../lib/openaiClient';
import Ajv from 'ajv';
import { ActionSuggestion, JiraIssue } from '../../../types/types';
import { retryWithExponentialBackoff } from '@/utils/retry';

const ajv = new Ajv();

// JSON Schema for ActionSuggestion remains unchanged
const actionSuggestionSchema = {
  type: 'object',
  properties: {
    action: { type: 'integer', enum: [1, 2, 3, 4] },
    description: { type: 'string' },
    keepIssueKey: { type: 'string' },
    deleteIssueKey: { type: 'string' },
    deleteIssueKeys: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
    },
    createIssueSummary: { type: 'string' },
    createIssueDescription: { type: 'string' },
    parentIssueKey: { type: 'string' },
    subtaskIssueKey: { type: 'string' },
  },
  required: ['action', 'description'],
  additionalProperties: false,
};

const validate = ajv.compile(actionSuggestionSchema);

export async function POST(request: Request) {
  try {
    const { issues, config } = await request.json();

    if (!config || !config.jiraEmail || !config.jiraApiToken || !config.jiraBaseUrl || !config.projectKey) {
      console.warn('Invalid Jira configuration provided:', config);
      return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
    }

    if (!issues || !Array.isArray(issues) || issues.length < 2) {
      console.warn('Invalid issues provided:', issues);
      return NextResponse.json(
        { error: 'Invalid issues provided. At least two issues are required for duplicate detection.' },
        { status: 400 }
      );
    }

    const suggestion = await getActionSuggestion(issues);
    validateSuggestion(suggestion);
    console.log('Action suggestion generated successfully:', suggestion);
    return NextResponse.json({ suggestion });
  } catch (error: unknown) {
    console.error('Error in /api/suggest-action:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get action suggestion.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function getActionSuggestion(issues: JiraIssue[]): Promise<ActionSuggestion> {
  const issueSummaries = issues.map(
    (issue) => `${issue.key}: ${issue.fields.summary}`
  ).join('\n');

  const prompt = `
You are a project management assistant. Analyze the following Jira issues for detail, clarity, and completeness based on these Hierarchy Rules:

### Hierarchy Rules:
- **Epics** can have Tasks, Stories, and Bugs as child issues.
- **Tasks**, **Stories**, and **Bugs** can have Subtasks as child issues.
- **Subtasks** cannot have child issues.

### Possible Actions:
1. **Delete One Issue and Keep the Other**: Remove the least descriptive or redundant issue and keep the more descriptive one.
2. **Delete Both Issues and Create a New Issue**: Remove both issues and create a new, better-formulated issue.
3. **Make One Issue a Subtask of the Other**: Convert one issue into a subtask under the other issue.
4. **Ignore Issues but Provide Option to Mark as Duplicates in Jira**: Suggest ignoring the duplication but still allow marking them as duplicates in Jira if needed.

### Instructions:
- **Primary Issue**: Identify which issue to keep if opting for Action 1 or the parent issue for Action 3.
- **Issues to Delete**: Specify which issue(s) to delete based on the selected action.
- **New Issue Summary**: Provide a summary for the new issue if opting for Action 2.
- **New Issue Description**: Provide a detailed description for the new issue if opting for Action 2.

**Important:** 
- **Prioritize Actions 1 through 3**. Use **Action 4** only if none of the first three actions are applicable.
- For **Action 4**, **only** suggest ignoring the issues but inform the user that they can manually mark them as duplicates in Jira.

**Response Guidelines:**
- When an action is selected, **only** include fields relevant to that action.
  - **Action 1:** Include \`keepIssueKey\` and \`deleteIssueKey\`.
  - **Action 2:** Include \`deleteIssueKeys\`, \`createIssueSummary\`, and \`createIssueDescription\`.
  - **Action 3:** Include \`parentIssueKey\` and \`subtaskIssueKey\`.
  - **Action 4:** Include \`description\` only.
- **Do not include fields not relevant to the selected action.**

Provide your recommendation in **JSON format only** using this structure. **Do not include additional text or explanations.**

{
  "action": Number, // 1, 2, 3, or 4
  "description": "Detailed description of the recommended action.",
  "keepIssueKey": "IssueKey1", // Only for Action 1
  "deleteIssueKey": "IssueKey2", // Only for Action 1
  "deleteIssueKeys": ["IssueKey1", "IssueKey2"], // Only for Action 2
  "createIssueSummary": "A new, better-formulated issue summary.", // Only for Action 2
  "createIssueDescription": "A new, detailed issue description.", // Only for Action 2
  "parentIssueKey": "IssueKey1", // Only for Action 3
  "subtaskIssueKey": "IssueKey2" // Only for Action 3
}

### **Issues:**
${issueSummaries}

Ensure the JSON is the only output.
`;

  console.log('Sending prompt to OpenAI:', prompt);

  const response = await retryWithExponentialBackoff(() =>
    openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0,
    })
  );

  const text = response.choices[0]?.message?.content?.trim();
  console.log('Received response from OpenAI:', text);

  const jsonText = text?.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error('Failed to extract JSON from response.');

  const suggestion = JSON.parse(jsonText);
  if (!validate(suggestion)) throw new Error('Invalid ActionSuggestion format.');

  return suggestion as ActionSuggestion;
}

/**
 * Validates the ActionSuggestion based on the action type.
 * Ensures that only relevant fields are present for each action.
 * @param suggestion - The ActionSuggestion object to validate.
 */
function validateSuggestion(suggestion: ActionSuggestion) {
  const validActions = [1, 2, 3, 4];
  if (!validActions.includes(suggestion.action)) {
    throw new Error(`Invalid action number: ${suggestion.action}`);
  }

  switch (suggestion.action) {
    case 1:
      if (!('keepIssueKey' in suggestion) || !suggestion.keepIssueKey) {
        throw new Error('keepIssueKey must be provided for Action 1.');
      }
      if (!('deleteIssueKey' in suggestion) || !suggestion.deleteIssueKey) {
        throw new Error('deleteIssueKey must be provided for Action 1.');
      }
      // Ensure deleteIssueKeys, createIssueSummary, createIssueDescription, parentIssueKey, subtaskIssueKey are not present
      const action1DisallowedFields = ['deleteIssueKeys', 'createIssueSummary', 'createIssueDescription', 'parentIssueKey', 'subtaskIssueKey'];
      for (const field of action1DisallowedFields) {
        if (field in suggestion) {
          throw new Error(`${field} should not be provided for Action 1.`);
        }
      }
      break;
    case 2:
      if (!('deleteIssueKeys' in suggestion) || suggestion.deleteIssueKeys!.length < 2) {
        throw new Error('At least two deleteIssueKeys must be provided for Action 2.');
      }
      if (!('createIssueSummary' in suggestion) || !suggestion.createIssueSummary) {
        throw new Error('createIssueSummary must be provided for Action 2.');
      }
      if (!('createIssueDescription' in suggestion) || !suggestion.createIssueDescription) {
        throw new Error('createIssueDescription must be provided for Action 2.');
      }
      // Ensure keepIssueKey, deleteIssueKey, parentIssueKey, subtaskIssueKey are not present
      const action2DisallowedFields = ['keepIssueKey', 'deleteIssueKey', 'parentIssueKey', 'subtaskIssueKey'];
      for (const field of action2DisallowedFields) {
        if (field in suggestion) {
          throw new Error(`${field} should not be provided for Action 2.`);
        }
      }
      break;
    case 3:
      if (!('parentIssueKey' in suggestion) || !suggestion.parentIssueKey) {
        throw new Error('parentIssueKey must be provided for Action 3.');
      }
      if (!('subtaskIssueKey' in suggestion) || !suggestion.subtaskIssueKey) {
        throw new Error('subtaskIssueKey must be provided for Action 3.');
      }
      // Ensure keepIssueKey, deleteIssueKey, deleteIssueKeys, createIssueSummary, createIssueDescription are not present
      const action3DisallowedFields = ['keepIssueKey', 'deleteIssueKey', 'deleteIssueKeys', 'createIssueSummary', 'createIssueDescription'];
      for (const field of action3DisallowedFields) {
        if (field in suggestion) {
          throw new Error(`${field} should not be provided for Action 3.`);
        }
      }
      break;
    case 4:
      // Action 4 only includes description
      const allowedFieldsForAction4 = ['action', 'description'];
      const extraFields = Object.keys(suggestion).filter(
        key => !allowedFieldsForAction4.includes(key)
      );
      if (extraFields.length > 0) {
        throw new Error('No additional fields should be provided for Action 4.');
      }
      break;
    default:
      // This should never happen due to the earlier check
      throw new Error(`Unhandled action number: ${suggestion.action}`);
  }
}
