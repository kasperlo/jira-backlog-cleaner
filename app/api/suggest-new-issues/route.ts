// app/api/suggest-new-issues/route.ts

import { NextResponse } from 'next/server';
import openai from '../../../lib/openaiClient';
import pinecone from '../../../lib/pineconeClient';
import { retrieveSimilarIssues } from '../../../utils/retrieveSimilarIssues';
import { SuggestedIssue, JiraIssue } from '../../../types/types';
import Ajv from 'ajv';
import { retryWithExponentialBackoff } from '@/utils/retry';
import { PINECONE_INDEX_NAME } from '@/config';

// Initialize AJV for JSON schema validation
const ajv = new Ajv();
const suggestionSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      description: { type: 'string' },
      issuetype: { type: 'string', enum: ['Story', 'Task', 'Subtask'] },
      explanation: { type: 'string' },
    },
    required: ['summary', 'description', 'issuetype', 'explanation'],
    additionalProperties: false,
  },
};
const validate = ajv.compile(suggestionSchema);

// Function to extract JSON array from the response text
function extractJsonFromResponse(responseText: string): string {
  // Remove code block delimiters and language specifiers
  responseText = responseText.replace(/```json\s*/g, '').replace(/```/g, '').trim();

  // Extract the JSON array using a regular expression
  const jsonMatch = responseText.match(/\[.*\]/s);
  if (jsonMatch) {
    return jsonMatch[0];
  } else {
    throw new Error('No JSON array found in the response.');
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    console.log('Request Payload:', requestBody);

    const { projectDescription, config } = await request.json();

    if (!projectDescription || !config) {
      const missingField = !projectDescription ? 'Project description' : 'Jira configuration';
      console.error(`${missingField} is missing`);
      return NextResponse.json({ error: `${missingField} is required.` }, { status: 400 });
    }

    // Generate embedding for the project description
    console.log('Generating embedding for project description:', projectDescription);
    const embeddingResponse = await retryWithExponentialBackoff(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: projectDescription,
      })
    );

    console.log('OpenAI Embedding Response:', embeddingResponse);

    const queryEmbedding = embeddingResponse.data[0].embedding;

    if (!queryEmbedding) {
      console.error('Failed to get query embedding from OpenAI');
      throw new Error('Embedding response is missing data.');
  }

    // Retrieve similar issues from Pinecone (topK=10)
    console.log('Retrieving similar issues using Pinecone...');
    const similarIssues: JiraIssue[] = await retrieveSimilarIssues(queryEmbedding, 10, config.projectKey);
    console.log('Retrieved Similar Issues:', similarIssues);

    const similarityThreshold = 0.1;
    const isRelevant = similarIssues.some((issue) => issue.fields.similarity! >= similarityThreshold);
    if (!isRelevant) {
      return NextResponse.json({ error: 'The project description does not appear to be correct.' }, { status: 400 });
    }

    const index = pinecone.Index(PINECONE_INDEX_NAME || "masterz-3072");
        const stats = await index.describeIndexStats();
        console.log('Pinecone Index Stats:', stats);
        
    const totalExistingIssues = stats.totalRecordCount || 0;

    const existingIssuesText = similarIssues
      .map((issue: JiraIssue) => `
{
  "summary": "${issue.fields.summary.replace(/"/g, '\\"')}",
  "description": "${issue.fields.description ? issue.fields.description.replace(/"/g, '\\"') : ''}",
  "issuetype": "${issue.fields.issuetype.name}",
  "explanation": "${issue.fields.description ? 'Based on the project requirements and existing issues.' : 'No description provided.'}"
}`)
      .join(',\n');

    const exampleIssuesText = similarIssues.slice(0, 2)
      .map((issue: JiraIssue) => `
{
  "summary": "${issue.fields.summary.replace(/"/g, '\\"')}",
  "description": "${issue.fields.description ? issue.fields.description.replace(/"/g, '\\"') : ''}",
  "issuetype": "${issue.fields.issuetype.name}",
  "explanation": "${issue.fields.description ? 'Based on the project requirements and existing issues.' : 'No description provided.'}"
}`)
      .join(',\n');

    // Construct the prompt
    const prompt = `
You are a project management assistant. Based on the following project description and existing issues, suggest new issues (user stories, tasks, subtasks) that may have been overlooked or are necessary to improve the project backlog. Do not suggest epics.

**Instructions:**
1. **Analyze Existing Issue Formats:**
   - Review the provided existing issues to identify the common formats used for user stories and tasks.
   - If a consistent format is detected for user stories and tasks, use the same format for the suggested issues.
   - If there is no clear consistency in the existing formats, default to the following templates:
     - **User Story:** "As a [role], I want to [goal], so that [benefit]."
     - **Task:** "[Action verb] [specific action] to [achieve a specific outcome]."

2. **Differentiate Between Tasks and User Stories:**
   - **User Stories** should be suggested when the requirement is **vague** or **requires further discussion** to understand the underlying need. They should focus on **who** needs something and **why**.
   - **Tasks** should be suggested when the requirement is **straightforward**, **well-defined**, and **can be completed independently** without needing further clarification.

3. **Avoid Duplicates:**
   - Ensure that none of the suggested issues duplicate or closely resemble existing issues in the backlog.
   - Focus on suggesting novel and unique issues that address different aspects or gaps in the project.

4. **Suggested Issues Requirements:**
   - Each suggested issue must include:
     - **"summary"**: A concise summary of the issue.
     - **"description"**: A detailed description of the issue.
     - **"issuetype"**: The type of issue ("Task", "Story", "Subtask", etc.). Do not include "Epic".
     - **"explanation"**: A brief explanation of why this issue is suggested and which uncovered area of the project it addresses.

5. **Format:**
   - Return the suggestions strictly in the following JSON array format without any additional text, explanations, or code block formatting (do not use triple backticks or specify the language). Do not include any markdown syntax.
   - Output only valid JSON. Do not include any introductory or concluding text.

[
  {
    "summary": "Issue summary",
    "description": "Detailed description of the issue.",
    "issuetype": "Task",
    "explanation": "Explanation of why this issue is suggested and what uncovered area it addresses."
  },
  ...
]

**Project Description:**
"""
${projectDescription}
"""

**Existing Issues:**
"""
${existingIssuesText}
"""

**Examples of Existing Issues:**
[
${exampleIssuesText}
]
`;

    console.log('Prompt constructed for OpenAI:', prompt);

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5000,
      temperature: 0.5,
    });

    const suggestionsText = response.choices[0]?.message?.content?.trim();

    let suggestions: SuggestedIssue[] = [];
    try {
      // Sanitize the response by extracting the JSON array
      const sanitizedText = extractJsonFromResponse(suggestionsText || '[]');
      suggestions = JSON.parse(sanitizedText);

      const valid = validate(suggestions);
      if (!valid) {
        console.error('Validation errors:', validate.errors);
        throw new Error('Invalid suggestions format received from OpenAI.');
      }

      const filteredSuggestions: SuggestedIssue[] = [];

      for (const suggestion of suggestions) {
        const suggestionEmbeddingResponse = await retryWithExponentialBackoff(() =>
          openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: suggestion.summary,
          })
        );

        const suggestionEmbedding = suggestionEmbeddingResponse.data[0].embedding;
        const duplicateCheckResponse = await index.query({
          vector: suggestionEmbedding,
          topK: 1,
          includeMetadata: false,
          includeValues: false,
        });

        const topMatch = duplicateCheckResponse.matches[0];
        const similarityScore = topMatch ? topMatch.score : 0;
        const similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75');

        if (similarityScore! < similarityThreshold) {
          filteredSuggestions.push(suggestion);
        } else {
          console.log(`Duplicate suggestion filtered out: ${suggestion.summary}`);
        }
      }

      console.log(`Total existing issues compared against: ${totalExistingIssues}`);

      return NextResponse.json({ suggestions: filteredSuggestions });
    } catch (err) {
      console.error('Error parsing or validating OpenAI response:', err);
      return NextResponse.json({ error: 'Failed to parse OpenAI response.' }, { status: 500 });
    }
  } catch (err: unknown) {
    console.error('Error in suggest-new-issues endpoint:', err);
    return NextResponse.json({ error: 'Internal server error in suggest-new-issues endpoint.' }, { status: 500 });
  }
}
