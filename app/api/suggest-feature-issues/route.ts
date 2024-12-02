// app/api/suggest-feature-issues/route.ts

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

export async function POST(request: Request) {
  try {
    const { feature, projectDescription, config } = await request.json();

    if (!feature || !projectDescription || !config) {
      return NextResponse.json({ error: 'Feature, project description, and Jira configuration are required.' }, { status: 400 });
    }

    // Generate embedding for the feature
    const embeddingResponse = await retryWithExponentialBackoff(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: feature,
      })
    );

    const featureEmbedding = embeddingResponse.data[0].embedding;

    // Retrieve similar issues from Pinecone (topK=3)
    const similarIssues: JiraIssue[] = await retrieveSimilarIssues(featureEmbedding, 3, config.projectKey);

    const similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75');
    const isSimilar = similarIssues.some((issue) => issue.fields.similarity! >= similarityThreshold);

    if (isSimilar) {
      // Return similar issues
      return NextResponse.json({ similarIssues });
    } else {
      // Prompt OpenAI with project description and feature to get suggestions
      const prompt = `
You are a project management assistant. Based on the following project description and the desired feature, suggest 5 new issues (user stories, tasks, subtasks) that address the feature. Do not suggest epics.

**Project Description:**
"""
${projectDescription}
"""

**Desired Feature:**
"""
${feature}
"""

**Instructions:**
- For each suggested issue, include:
  - "summary": A concise summary.
  - "description": A detailed description.
  - "issuetype": The type of issue ("Task", "Story", "Subtask"). Do not include "Epic".
  - "explanation": A brief explanation of why this issue is suggested.

  - Do not include any markdown formatting (e.g., backticks).
  - Provide the JSON array directly, without additional explanations or headers.
  
[
  {
    "summary": "Issue summary",
    "description": "Detailed description.",
    "issuetype": "Task",
    "explanation": "Explanation."
  },
  ...
]
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const suggestionsText = response.choices[0]?.message?.content?.trim();

      let suggestions: SuggestedIssue[] = [];
      try {
        suggestions = JSON.parse(suggestionsText || "[]");

        const valid = validate(suggestions);
        if (!valid) {
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
          const duplicateCheckResponse = await pinecone.index(PINECONE_INDEX_NAME).query({
            vector: suggestionEmbedding,
            topK: 1,
            includeMetadata: false,
            includeValues: false,
          });

          const topMatch = duplicateCheckResponse.matches[0];
          const similarityScore = topMatch ? topMatch.score : 0;

          if (similarityScore! < similarityThreshold) {
            filteredSuggestions.push(suggestion);
          }
        }

        return NextResponse.json({ suggestions: filteredSuggestions });
      } catch (err) {
        console.error('Error parsing or validating OpenAI response:', err);
        return NextResponse.json({ error: 'Failed to parse OpenAI response.' }, { status: 500 });
      }
    }

  } catch (err: unknown) {
    console.error('Error in suggest-feature-issues endpoint:', err);
    return NextResponse.json({ error: 'Internal server error in suggest-feature-issues endpoint.' }, { status: 500 });
  }
}
