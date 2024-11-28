// app/api/suggest-project-description/route.ts

import { NextResponse } from 'next/server';
import openai from '../../../lib/openaiClient';
import { JiraIssue } from '../../../types/types';
import { fetchAllIssues } from '../../../utils/issueProcessor'; // Updated import

export async function POST(request: Request) {
  try {
    const { projectDescription, config } = await request.json();

    if (!config) {
      return NextResponse.json({ error: 'Jira configuration is required.' }, { status: 400 });
    }

    // Fetch all issues from Jira using fetchAllIssues
    const issues: JiraIssue[] = await fetchAllIssues(config);

    const issuesText = issues
      .map((issue) => `- ${issue.fields.summary}`)
      .join('\n');

    // Construct the prompt
    const prompt = `
You are a project management assistant. Based on the list of issues and the current project description, suggest an improved project description that better encapsulates the project goals and requirements.

**Current Project Description:**
"""
${projectDescription}
"""

**List of Issues:**
"""
${issuesText}
"""

**Instructions:**
- Provide a concise and clear project description.
- Focus on the main objectives and requirements evident from the issues.
- Do not include any irrelevant information.

**Improved Project Description:**
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const newProjectDescription = response.choices[0]?.message?.content?.trim();

    return NextResponse.json({ newProjectDescription });

  } catch (err: unknown) {
    console.error('Error in suggest-project-description endpoint:', err);
    return NextResponse.json({ error: 'Internal server error in suggest-project-description endpoint.' }, { status: 500 });
  }
}
