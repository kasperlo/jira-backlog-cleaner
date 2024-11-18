import { NextResponse } from 'next/server';
import openai from '../../../lib/openaiClient';
import { JiraIssue } from '@/types/types';

export async function POST(request: Request) {
  try {
    const { issues, config } = await request.json();

    if (!issues || issues.length < 2) {
      return NextResponse.json({ error: 'Two issues are required to merge.' }, { status: 400 });
    }

    const issueSummaries = issues.map(
      (issue: JiraIssue) => `Issue ${issue.key}: ${issue.fields.summary}\nDescription: ${issue.fields.description || 'No description provided.'}`
    ).join('\n\n');

    const prompt = `
    You are a project management assistant. Analyze the following Jira issues and suggest a new issue that combines their semantic meaning. Ensure that the new issue covers the essential points of both, maintaining a clear and concise structure.
    
    ### Important Guidelines:
    1. **Mimic the Structure and Language Style**: Pay close attention to the way each issue is formulated, including the voice (e.g., "As a Project Manager...") and structure (e.g., user stories or specific action-based statements). The new issue should follow a similar style to maintain consistency.
    2. **Use Formality and Perspective**: If the issues are written in a specific tone (e.g., formal or professional) or perspective (e.g., "As a [Role], I want to..."), maintain that in the new issue.
    3. **Avoid Summarization Only**: Do not simply summarize; instead, aim to create a merged issue that retains the formulation style and specific details provided by the original issues.
    
    ### Issues to Merge:
    ${issueSummaries}
    
    ### Instructions:
    - Please respond only in JSON format, with no explanations or extra text.
    - 
    - Use this exact format:
    
    {
      "fields": {
        "summary": "Suggested merged issue summary in the same style as provided issues",
        "description": "Detailed description covering both issues, matching the style and structure.",
        "issuetype": {
          "name": "Story", "Epic" or "Task", based on the scope of the issue, and the issuetype of the duplicate issues. If the duplicate issues are both of the same type, then that type shall be used for the suggested issue as well.
        }
      }
    }
    `;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.5,
    });
    

    const suggestionText = response.choices[0]?.message?.content?.trim();

    // Extract JSON using regex to capture only the JSON structure
    const jsonMatch = suggestionText?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in the response.');
    }

    const suggestionJson = JSON.parse(jsonMatch[0]);

    // Verify necessary fields exist in the JSON response
    if (!suggestionJson.fields || !suggestionJson.fields.summary || !suggestionJson.fields.description || !suggestionJson.fields.issuetype) {
      throw new Error('Invalid response from OpenAI');
    }

    // Construct the suggestion in JiraIssue format
    const suggestionIssue: JiraIssue = {
      id: 'new-suggestion',
      key: 'NEW-ISSUE',
      fields: {
        summary: suggestionJson.fields.summary,
        description: suggestionJson.fields.description,
        issuetype: suggestionJson.fields.issuetype,
        created: new Date().toISOString(),
        subtasks: []
      }
    };

    return NextResponse.json({ suggestion: suggestionIssue });
  } catch (error) {
    console.error('Error generating merge suggestion:', error);
    return NextResponse.json({ error: 'Failed to generate merge suggestion.' }, { status: 500 });
  }
}
