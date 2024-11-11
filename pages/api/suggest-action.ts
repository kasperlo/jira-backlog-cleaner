// pages/api/suggest-action.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import openai from '../../lib/openaiClient';
import Ajv from 'ajv';
import { ActionSuggestion, JiraIssue } from '../../types/types';
import JiraClient from 'jira-client';
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    console.warn(`Method ${req.method} not allowed on /api/suggest-action`);
    return;
  }

  const { issues, config } = req.body;

  if (!config || !config.jiraEmail || !config.jiraApiToken || !config.jiraBaseUrl || !config.projectKey) {
    console.warn('Invalid Jira configuration provided:', config);
    res.status(400).json({ error: 'Invalid Jira configuration provided.' });
    return;
  }

  if (!issues || !Array.isArray(issues) || issues.length < 2) {
    console.warn('Invalid issues provided:', issues);
    res.status(400).json({ error: 'Invalid issues provided. At least two issues are required for duplicate detection.' });
    return;
  }

  // Initialize Jira client with user-provided config
  const jira = new JiraClient({
    protocol: 'https',
    host: config.jiraBaseUrl.replace(/^https?:\/\//, ''), // Remove protocol
    username: config.jiraEmail,
    password: config.jiraApiToken,
    apiVersion: '2',
    strictSSL: true,
  });

  try {
    const suggestion = await getActionSuggestion(issues, jira);
    validateSuggestion(suggestion);
    console.log('Action suggestion generated successfully:', suggestion);
    res.status(200).json({ suggestion });
  } catch (error: any) {
    console.error('Error in /api/suggest-action:', error);
    res.status(500).json({
      error: error.message || 'Failed to get action suggestion.',
    });
  }
}

async function getActionSuggestion(issues: JiraIssue[], jira: JiraClient): Promise<ActionSuggestion> {
  const issueSummaries = issues.map(
    (issue) => `${issue.key}: ${issue.fields.summary}`
  ).join('\n');

  const prompt = `
You are a project management assistant. Analyze the following Jira issues for detail, clarity, and completeness based on these Hierarchy Rules:

### Hierarchy Rules:
- **Epics** can have Tasks, Stories, and Bugs as child issues.
- **Tasks**, **Stories**, and **Bugs** can have Sub-tasks as child issues.
- **Sub-tasks** cannot have child issues.

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

  const maxRetries = 3;
  let attempt = 0;
  let delayMs = 1000; // 1 second

  while (attempt < maxRetries) {
    try {
      const response = await retryWithExponentialBackoff(() =>
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0,
        })
      );

      const text = response.choices[0]?.message?.content?.trim();

      if (!text) {
        console.error('Empty response from OpenAI');
        throw new Error('No response from OpenAI');
      }

      console.log('Received response from OpenAI:', text);

      // Extract JSON from the response
      let jsonText = text;
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        jsonText = match[0];
      } else {
        console.error('No JSON object found in the OpenAI response');
        throw new Error('No JSON object found in the response');
      }

      console.log('Extracted JSON:', jsonText);

      // Parse the response
      let suggestion: ActionSuggestion;
      try {
        suggestion = JSON.parse(jsonText);
      } catch (err) {
        console.error('Error parsing OpenAI response:', err, 'Response Text:', text);
        throw new Error('Failed to parse OpenAI response');
      }

      // Validate the suggestion against the schema
      if (!validate(suggestion)) {
        console.error('Invalid ActionSuggestion format:', validate.errors);
        throw new Error('Invalid ActionSuggestion format.');
      }

      // No need to assign default arrays since the response includes only relevant fields

      return suggestion as ActionSuggestion; // Type assertion to assist TypeScript
    } catch (error: any) {
      attempt++;
      console.error(`Attempt ${attempt} - Error during OpenAI processing:`, error);

      if (attempt >= maxRetries) {
        throw new Error(error.message || 'Failed to generate action suggestion after multiple attempts.');
      }

      console.log(`Retrying in ${delayMs / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2; // Exponential backoff
    }
  }

  throw new Error('Failed to generate action suggestion.');
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
