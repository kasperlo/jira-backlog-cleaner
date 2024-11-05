// pages/api/suggest-new-issues.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import openai from '../../lib/openaiClient';
import { retrieveSimilarIssues } from '../../utils/retrieveSimilarIssues';

interface Suggestion {
  summary: string;
  description: string;
  issuetype: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectDescription } = req.body;

  if (!projectDescription) {
    res.status(400).json({ error: 'Project description is required.' });
    return;
  }

  try {
    console.log('Generating embedding for project description:', projectDescription);

    // Generate embedding for the project description
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: projectDescription,
    });

    console.log('Embedding generated successfully:', embeddingResponse);

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Retrieve similar issues from Pinecone
    console.log('Retrieving similar issues using Pinecone...');
    const similarIssues = await retrieveSimilarIssues(queryEmbedding);
    console.log('Retrieved similar issues:', similarIssues);

    // Construct the prompt
    const similarIssuesText = similarIssues
      .map((issue) => `${issue.key}: ${issue.fields.summary}`)
      .join('\n');

      const prompt = `
      You are an assistant that provides new project management tasks in JSON format. Based on the project description and existing issues provided, suggest new issues (user stories, epics, tasks, subtasks) that may have been missed. Return the suggestions strictly in the JSON array format below:
      
      [
        {
          "summary": "Issue summary",
          "description": "Detailed description",
          "issuetype": "Task" // or "Story", "Epic", etc.
        },
        ...
      ]
      
      DO NOT include any explanations or additional text, and ensure the JSON array is the only output.
      Here is the project description:
      
      ${projectDescription}
      
      Existing issues:
      
      ${similarIssuesText}
      `;
      

    console.log('Prompt constructed for OpenAI:', prompt);

    // Call OpenAI API for chat completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    console.log('OpenAI API response received:', response);

    const suggestionsText = response.choices[0]?.message?.content?.trim();

    // Parse the response
    let suggestions: Suggestion[] = [];
    try {
      suggestions = JSON.parse(suggestionsText || "");
    } catch (err) {
      console.error('Error parsing OpenAI response as JSON:', err);
      console.error('OpenAI response content that failed to parse:', suggestionsText);
      throw new Error('Failed to parse OpenAI response');
    }

    res.status(200).json({ suggestions });
  } catch (error: any) {
    if (error.response) {
      console.error('OpenAI API Error:', error.response.status, error.response.data);
    } else {
      console.error('Error suggesting new issues:', error.message || error);
    }
    res.status(500).json({ error: 'Failed to suggest new issues.' });
  }
}
