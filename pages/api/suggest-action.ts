// pages/api/suggest-action.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import openai from '../../lib/openaiClient';

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      name: string;
    };
    // Add other fields as needed
  };
}

interface ActionSuggestion {
  action: string;
  description: string;
  deleteIssueKeys?: string[];
  keepIssueKeys?: string[];
  modifyIssueKeys?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { issues } = req.body;

  if (!issues || !Array.isArray(issues) || issues.length < 2) {
    res.status(400).json({ error: 'Invalid issues provided.' });
    return;
  }

  try {
    const suggestion = await getActionSuggestion(issues);
    res.status(200).json({ suggestion });
  } catch (error: any) {
    console.error('Error getting action suggestion:', error);
    res.status(500).json({
      error: 'Failed to get action suggestion.',
    });
  }
}

async function getActionSuggestion(issues: JiraIssue[]): Promise<ActionSuggestion> {
  const issueSummaries = issues.map(
    (issue) => `${issue.key}: ${issue.fields.summary}`
  ).join('\n');

  const prompt = `
  You are a project management assistant. Given the following Jira issues that are being considered for consolidation, analyze the level of detail, clarity, and completeness of their summaries. Use the following guidelines and action options:
  
  ### Hierarchy Rules:
  - Epics can have Tasks, Stories, and Bugs as child issues.
  - Tasks, Stories, and Bugs can have Sub-tasks as child issues.
  - Sub-tasks cannot have child issues.
  
  ### Possible Actions:
  1. **Delete**: Delete the least descriptive or less clear issue if it's redundant, and keep the one with more detail and clarity.
  2. **Convert to Sub-task**: If one issue is more specific than the other and can be considered part of it, convert the specific issue into a subtask of the broader issue (e.g., convert a Task into a Sub-task under a Story).
  3. **Other Suggestions**: If neither of the above actions applies, suggest other ways to improve the backlog organization, like splitting or consolidating related issues.
  
  When choosing an action:
  - Use **Action 1** to delete an issue only if it’s fully redundant.
  - Use **Action 2** if an issue could logically be a subtask of another according to the hierarchy rules. For example, a Task that describes a detailed part of a Story should be converted to a Sub-task of that Story.
  - Only use **Action 3** if no clear subtask relationship can be established but some other restructuring is suggested.
  
  Provide your recommendation in JSON format using the structure below. Include only the keys relevant to the action.
  
  {
    "action": "Action Number",
    "description": "Detailed description of the recommended action.",
    "deleteIssueKeys": ["IssueKey1"],
    "keepIssueKeys": ["IssueKey2"],
    "modifyIssueKeys": ["IssueKey3"]
  }
  
  Here are the issues:
  
  ${issueSummaries}
  
  Ensure the JSON is the only output.
  `;
  

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0,
  });

  const text = response.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('No response from OpenAI');
  }

  // Extract JSON from the response
  let jsonText = text;
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    jsonText = match[0];
  }

  // Parse the response
  let suggestion: ActionSuggestion;
  try {
    suggestion = JSON.parse(jsonText);
  } catch (err) {
    console.error('Error parsing OpenAI response:', err);
    throw new Error('Failed to parse OpenAI response');
  }

  // Ensure arrays are initialized
  suggestion.deleteIssueKeys = suggestion.deleteIssueKeys || [];
  suggestion.keepIssueKeys = suggestion.keepIssueKeys || [];
  suggestion.modifyIssueKeys = suggestion.modifyIssueKeys || [];

  return suggestion;
}
