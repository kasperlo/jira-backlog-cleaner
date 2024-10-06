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
You are a project management assistant. Given the following Jira issues that are considered duplicates, analyze the level of detail, clarity, and completeness of their summaries. The possible actions are:

1. Delete one issue (the least descriptive or less clear one), and possibly reformulate the other if it needs to be more descriptive.
2. Merge into a different type (e.g., convert to a task, subtask, user story, or epic).
3. Make one issue a subtask of the other.
4. Other suggestions.

When choosing Action 1, ensure that you recommend deleting the issue with the less descriptive or less clear summary, and keep the one with the more detailed and informative summary. Consider that issue summaries that are just keywords or fragments are less descriptive than those that are complete sentences.

Provide your recommendation by specifying the action number and a brief description of what should be done. Include the specific issue keys that should be deleted, kept, or modified. The response should be in JSON format with the following structure:

{
  "action": "Action Number",
  "description": "Detailed description of the recommended action.",
  "deleteIssueKeys": ["IssueKey1", "IssueKey2"],
  "keepIssueKeys": ["IssueKey3"],
  "modifyIssueKeys": ["IssueKey4"]
}

Only include the keys relevant to the action.

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
