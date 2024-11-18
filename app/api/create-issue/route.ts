// app/api/create-issue/route.ts

import { NextResponse } from 'next/server';
import { JiraConfig } from '@/types/types';
import { createJiraClient } from '@/lib/jiraClient';
import openai from '@/lib/openaiClient';
import { retryWithExponentialBackoff } from '@/utils/retry';
import { PINECONE_INDEX_NAME } from '@/config';
import pinecone from '@/lib/pineconeClient';

export async function POST(request: Request) {
  try {
    const { suggestion, isEpic, config, subtasks } = await request.json();

    // Validate Jira configuration
    if (
      !config ||
      !config.jiraEmail ||
      !config.jiraApiToken ||
      !config.jiraBaseUrl ||
      !config.projectKey
    ) {
      console.warn('Invalid Jira configuration provided:', config);
      return NextResponse.json({ error: 'Invalid Jira configuration provided.' }, { status: 400 });
    }

    // Validate suggestion
    if (!suggestion || !suggestion.summary || !suggestion.description || !suggestion.issuetype) {
      return NextResponse.json(
        { error: 'Suggestion must include summary, description, and issuetype.' },
        { status: 400 }
      );
    }

    const jira = createJiraClient(config as JiraConfig);

    // Get all issue types to determine the correct Sub-task name
    const issueTypes = await jira.listIssueTypes();
    const subtaskIssueType = issueTypes.find(
      (type: { name: string }) => type.name === 'Sub-task' || type.name === 'Deloppgave'
    );

    if (!subtaskIssueType) {
      return NextResponse.json(
        { error: "Couldn't find the Sub-task issue type. Please check your Jira settings." },
        { status: 400 }
      );
    }

    const issueData: any = {
      fields: {
        project: {
          key: config.projectKey,
        },
        summary: suggestion.summary,
        description: suggestion.description || "",
        issuetype: {
          name: isEpic ? 'Epic' : suggestion.issuetype,
        },
      },
    };

    if (isEpic) {
      issueData.fields.customfield_10011 = suggestion.summary; // Adjust the custom field ID as per your Jira instance
    }

    // Create the main issue in Jira
    const issue = await jira.addNewIssue(issueData);

    // Fetch the newly created issue details
    const createdIssue = await jira.findIssue(
      issue.key,
      '',
      'summary,description,issuetype,parent,created,subtasks'
    );

    // Generate embeddings and upsert to Pinecone
    const text = `${createdIssue.fields.summary}\n${createdIssue.fields.description || ''}`;

    const embeddingResponse = await retryWithExponentialBackoff(() =>
      openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
      })
    );
    const embedding = embeddingResponse.data[0].embedding;

    // Upsert to Pinecone
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    await index.upsert([
      {
        id: issue.key,
        values: embedding,
        metadata: {
          issueKey: issue.key,
          summary: createdIssue.fields.summary,
          description: createdIssue.fields.description || '',
          issuetype: createdIssue.fields.issuetype.name,
          parentKey: createdIssue.fields.parent?.key || '',
        },
      },
    ]);

    // Handle Subtasks Creation
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      for (const subtaskTitle of subtasks) {
        const subtaskData = {
          fields: {
            project: {
              key: config.projectKey,
            },
            summary: subtaskTitle,
            description: '', // Optional: Add description if needed
            issuetype: {
              name: subtaskIssueType.name, // Use the dynamically determined subtask issue type name
            },
            parent: {
              key: issue.key,
            },
          },
        };

        // Create each subtask under the new issue
        try {
          await jira.addNewIssue(subtaskData);
        } catch (subtaskError: any) {
          console.error(`Error creating subtask '${subtaskTitle}':`, subtaskError);
          throw new Error(`Error creating subtask '${subtaskTitle}': ${subtaskError.response?.data?.errorMessages || subtaskError.message}`);
        }
      }
    }

    return NextResponse.json(
      { message: 'Issue and subtasks created successfully.', issue: createdIssue },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error creating issue:', error);
    return NextResponse.json({ error: 'Failed to create issue.' }, { status: 500 });
  }
}
