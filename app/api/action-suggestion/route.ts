import { NextResponse } from 'next/server';
import openai from '../../../lib/openaiClient';
import { JiraIssue } from '../../../types/types';
import { retryWithExponentialBackoff } from '@/utils/retry';

export async function POST(request: Request) {
  try {
    const { issues, config } = await request.json();

    if (!config || !Array.isArray(issues) || issues.length < 2) {
      return NextResponse.json({ error: 'Invalid input or configuration' }, { status: 400 });
    }

    const issueSummaries = issues.map(
      (issue) => `${issue.key}: ${issue.fields.summary}\nDescription: ${issue.fields.description || 'No description provided.'}`
    ).join('\n\n');

    const prompt = `
You are a project management assistant. Analyze the following Jira issues for redundancy, clarity, and importance based on these guidelines:

### Possible suggestions:
1. **Delete One Issue and Keep the Other**: Suggest which issue to delete if there's redundancy.
2. **Delete Both Issues and Create a New Issue**: If both issues are redundant but lack clarity, suggest a better-formulated issue.
3. **Make One Issue a Subtask of the Other**: If one issue helps solve the other, suggest which to convert into a subtask.
4. **Ignore Issues but Provide Option to Mark as Duplicates in Jira**: Suggest ignoring if neither action is needed but suggest marking as duplicates in Jira if helpful.

### Criteria:
- If there’s high redundancy: Suggest deleting one and keeping the other.
- If one issue could be part of the other (e.g., solving one helps solve the other): Suggest making it a subtask.
- If the issues are closely related but both are important: Suggest merging into one comprehensive issue.
- If both issues are unique and relevant: Suggest ignoring as a duplicate.

**Return JSON in this format only**:
{
  "action": Number, // 1, 2, 3, or 4
  "description": "Reasoning for suggested action",
  "keepIssueKey": "IssueKey", // For Action 1 or Action 3
  "deleteIssueKey": "IssueKey", // For Action 1 or Action 2
  "createIssueSummary": "Summary", // For Action 2
  "createIssueDescription": "Description", // For Action 2
  "parentIssueKey": "IssueKey", // For Action 3
  "subtaskIssueKey": "IssueKey" // For Action 3
}

### Issues:
${issueSummaries}
    `;

    const response = await retryWithExponentialBackoff(() =>
      openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.5,
      })
    );

    const suggestionText = response.choices[0]?.message?.content?.trim();
    const suggestion = JSON.parse(suggestionText || '{}');

    if (!suggestion.action) {
      throw new Error('Failed to generate a valid action suggestion.');
    }

    return NextResponse.json({ suggestion }, { status: 200 });
  } catch (error: any) {
    console.error('Error in suggest-action endpoint:', error);
    return NextResponse.json({ error: 'Failed to generate action suggestion' }, { status: 500 });
  }
}
