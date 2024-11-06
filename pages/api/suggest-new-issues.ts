// pages/api/suggest-new-issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import openai from '../../lib/openaiClient';
import pinecone from '../../lib/pineconeClient';
import { retrieveSimilarIssues } from '../../utils/retrieveSimilarIssues';
import { SuggestedIssue, JiraConfig, JiraIssue } from '../../types/types';
import Ajv from 'ajv';

// Initialize AJV for JSON schema validation
const ajv = new Ajv();
const suggestionSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      description: { type: 'string' },
      issuetype: { type: 'string', enum: ['Story', 'Task', 'Sub-task'] },
      explanation: { type: 'string' },
    },
    required: ['summary', 'description', 'issuetype', 'explanation'],
    additionalProperties: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { projectDescription, config } = req.body;

  if (!projectDescription) {
    res.status(400).json({ error: 'Project description is required.' });
    return;
  }

  if (!config) {
    res.status(400).json({ error: 'Jira configuration is required.' });
    return;
  }

  try {
    console.log('Generating embedding for project description:', projectDescription);

    // Generate embedding for the project description
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large', // Use the updated embedding model
      input: projectDescription,
    });

    console.log('Embedding generated successfully:', {
      model: embeddingResponse.model,
      usage: embeddingResponse.usage,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Retrieve similar issues from Pinecone (topK=10)
    console.log('Retrieving similar issues using Pinecone...');
    const similarIssues: JiraIssue[] = await retrieveSimilarIssues(queryEmbedding, 10);
    console.log(`Retrieved ${similarIssues.length} similar issues from Pinecone.`);

    // Log similarity scores
    similarIssues.forEach((issue, index) => {
      console.log(`Issue ${index + 1}: ${issue.key} with similarity score ${issue.fields.similarity}`);
    });

    // Determine the total number of existing issues
    const index = pinecone.Index('masterz-3072');
    const stats = await index.describeIndexStats();
    const totalExistingIssues = stats.totalRecordCount || 0;
    console.log(`Total existing issues in Pinecone index: ${totalExistingIssues}`);

    // Format existing issues as JSON objects for the prompt
    const existingIssuesText = similarIssues
      .map((issue: any) => `
{
  "summary": "${issue.fields.summary.replace(/"/g, '\\"')}",
  "description": "${issue.fields.description ? issue.fields.description.replace(/"/g, '\\"') : ''}",
  "issuetype": "${issue.fields.issuetype.name}",
  "explanation": "${issue.fields.description ? 'Based on the project requirements and existing issues.' : 'No description provided.'}"
}`)
      .join(',\n');

    // Optionally, include examples to guide GPT-4
    const exampleIssuesText = similarIssues.slice(0, 2)
      .map((issue: any) => `
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
     - **"issuetype"**: The type of issue ("Task", "Story", "Sub-task", etc.). Do not include "Epic".
     - **"explanation"**: A brief explanation of why this issue is suggested and which uncovered area of the project it addresses.

5. **Format:**
   - Return the suggestions strictly in the following JSON array format without any additional text or explanations:

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

    // Call OpenAI API for chat completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000, // Adjust as needed
      temperature: 0.7,
    });

    console.log('OpenAI API response received:', {
      id: response.id,
      model: response.model,
      choices: response.choices.length,
    });

    const suggestionsText = response.choices[0]?.message?.content?.trim();

    // Parse and validate the response
    let suggestions: SuggestedIssue[] = [];
    try {
      suggestions = JSON.parse(suggestionsText || "[]");

      const validate = ajv.compile(suggestionSchema);
      const valid = validate(suggestions);

      if (!valid) {
        console.error('Validation errors:', validate.errors);
        throw new Error('Invalid suggestions format received from OpenAI.');
      }

      // Post-process suggestions to ensure no overlap
      const filteredSuggestions: SuggestedIssue[] = [];

      for (const suggestion of suggestions) {
        // Generate embedding for the suggestion summary
        const suggestionEmbeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: suggestion.summary,
        });

        console.log(`Embedding generated for suggestion: ${suggestion.summary}`);

        const suggestionEmbedding = suggestionEmbeddingResponse.data[0].embedding;

        // Perform a similarity search in Pinecone for the suggestion embedding
        const duplicateCheckResponse = await pinecone.index('masterz-3072').query({
          vector: suggestionEmbedding,
          topK: 1, // Retrieve the most similar existing issue
          includeMetadata: false,
          includeValues: false,
        });

        // Check if any existing issue has similarity > 0.75
        const topMatch = duplicateCheckResponse.matches[0];
        const similarityScore = topMatch ? topMatch.score : 0;

        const similarityThreshold: number = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.75');
        console.log(`Similarity score for suggestion "${suggestion.summary}": ${similarityScore}`);

        if (similarityScore! < similarityThreshold) {
          // Suggestion is unique enough
          filteredSuggestions.push(suggestion);
        } else {
          console.log(`Duplicate suggestion filtered out: ${suggestion.summary}`);
        }
      }

      // Log the number of comparisons made
      console.log(`Total existing issues compared against: ${totalExistingIssues}`);

      res.status(200).json({ suggestions: filteredSuggestions });
    } catch (err) {
      console.error('Error parsing or validating OpenAI response:', err);
      console.error('OpenAI response content that failed to parse:', suggestionsText);
      res.status(500).json({ error: 'Failed to parse OpenAI response.' });
    }

  } catch (error: any) {
    if (error.response) {
      console.error('OpenAI API Error:', error.response.status, error.response.data);
    } else {
      console.error('Error suggesting new issues:', error.message || error);
    }
    res.status(500).json({ error: 'Failed to suggest new issues.' });
  }
}
