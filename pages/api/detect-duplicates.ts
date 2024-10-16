// pages/api/detect-duplicates.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';
import openai from '../../lib/openaiClient';

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: {
      name: string;
    };
    parent?: {
      key: string;
    };
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
    const response = await jira.searchJira(jql, {
      fields: ['summary', 'issuetype', 'parent'],
    });    const issues: JiraIssue[] = response.issues;

    // Prepare data for OpenAI
    const summaries = issues.map((issue) => {
      const parentKey = issue.fields.parent?.key || 'None';
      return `${issue.key} (Parent: ${parentKey}) - ${issue.fields.summary}`;
    });
    
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

Here is a list of tasks:
${summaries.join('\n')}

Important Notes:
- Consider tasks as duplicates if they have the same intent or objectives, even if they are phrased differently or use synonyms.
- Pay special attention to tasks that are paraphrased but mean the same thing.
- Do NOT consider tasks as duplicates if they are subtasks of the same parent issue.
- Do NOT consider tasks as duplicates if they are the same issue (i.e., have the same issue key).

Group the tasks that are duplicates (i.e., they describe the same or very similar work) and provide the groups as an array of objects in valid JSON format, where each object contains:
- "group": an array of issue keys of the duplicate tasks (e.g., ["ISSUE-1", "ISSUE-3"]).
- "explanation": a one-sentence explanation of why these tasks are duplicates.

Only include groups with more than one task.

Ensure the JSON is the only output.

Example Output:
[
  {
    "group": ["BG-1", "BG-3"],
    "explanation": "Both tasks involve testing and validating the backlog grooming tool to meet project managers' needs."
  }
]
`;


  const response = await openai.chat.completions.create({
    model: 'gpt-4',
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

  // Create a map of issue keys to issues
  const issueMap = new Map<string, JiraIssue>();
  issues.forEach((issue) => {
    issueMap.set(issue.key, issue);
  });

  // Parse the response
  let duplicateGroupsRaw: { group: string[]; explanation: string }[] = [];
  try {
    duplicateGroupsRaw = JSON.parse(jsonText);
  } catch (err) {
    console.error('Error parsing OpenAI response:', err);
    throw new Error('Failed to parse OpenAI response');
  }

  // Map issue keys to issues and form DuplicateGroup[]
  const duplicateGroups: DuplicateGroup[] = duplicateGroupsRaw.map((item) => ({
    group: item.group
      .map((key) => issueMap.get(key))
      .filter((issue): issue is JiraIssue => issue !== undefined),
    explanation: item.explanation,
  }));

  return duplicateGroups;
}

