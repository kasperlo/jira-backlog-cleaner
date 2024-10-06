// pages/api/detect-duplicates.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    // Add other fields as needed
  };
}

interface DuplicateGroup {
  group: JiraIssue[];
  explanation: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Fetch issues from Jira
    const jql = 'project = "BG" AND status = "To Do"';
    const response = await jira.searchJira(jql);
    const issues: JiraIssue[] = response.issues;

    // Prepare data for OpenAI
    const summaries = issues.map((issue) => issue.fields.summary);

    // Call OpenAI API to detect duplicates
    const duplicates = await detectDuplicatesWithOpenAI(summaries, issues);

    res.status(200).json({ duplicates });
  } catch (error: any) {
    console.error('Error detecting duplicates:', error);
    res.status(500).json({
      error:
        error.response?.data?.errorMessages?.[0] || 'Failed to detect duplicates',
    });
  }
}

async function detectDuplicatesWithOpenAI(
  summaries: string[],
  issues: JiraIssue[]
): Promise<DuplicateGroup[]> {
  const prompt = `
You are an assistant that identifies duplicate tasks in a list.

Here is a list of task summaries:
${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Group the tasks that are duplicates (i.e., they describe the same or very similar work) and provide the groups as an array of objects in valid JSON format, where each object contains:
- "group": an array of indices of the duplicate tasks (indices start from 1)
- "explanation": a one-sentence explanation of why these tasks are duplicates.

Only include groups with more than one task.

Ensure the JSON is the only output.

Example Output:
[
  {
    "group": [1, 3],
    "explanation": "Both tasks are about fixing login issues in the user portal."
  },
  {
    "group": [2, 4],
    "explanation": "Both tasks involve updating the dashboard's UI/design."
  }
]
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0,
  });

  const text = response.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('No response from OpenAI');
  }

  // Extract JSON from the response
  let jsonText = text;
  const match = text.match(/\[.*\]/s);
  if (match) {
    jsonText = match[0];
  }

  // Parse the response
  let duplicateGroupsRaw: { group: number[]; explanation: string }[] = [];
  try {
    duplicateGroupsRaw = JSON.parse(jsonText);
  } catch (err) {
    console.error('Error parsing OpenAI response:', err);
    throw new Error('Failed to parse OpenAI response');
  }

  // Map indices to issues and form DuplicateGroup[]
  const duplicateGroups: DuplicateGroup[] = duplicateGroupsRaw.map((item) => ({
    group: item.group.map((index) => issues[index - 1]),
    explanation: item.explanation,
  }));

  return duplicateGroups;
}
