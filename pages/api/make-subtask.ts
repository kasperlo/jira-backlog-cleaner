import type { NextApiRequest, NextApiResponse } from 'next';
import jira from '../../lib/jiraClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const { parentIssueKey, subtaskIssueKey } = req.body;

  if (!parentIssueKey || !subtaskIssueKey) {
    res.status(400).json({
      error: 'Parent issue key and subtask issue key are required.',
    });
    return;
  }

  try {
    // Fetch details of parent and subtask issues
    const parentIssue = await jira.findIssue(
      parentIssueKey,
      '',
      'summary,project,issuetype'
    );
    const subtaskIssue = await jira.findIssue(
      subtaskIssueKey,
      '',
      'summary,project,description'
    );

    // Ensure the parent and subtask are in the same project
    if (parentIssue.fields.project.key !== subtaskIssue.fields.project.key) {
      res.status(400).json({
        error: 'The parent issue and subtask issue must be in the same project.',
      });
      return;
    }

    // Check if parent issue type supports subtasks
    const parentIssueType = parentIssue.fields.issuetype.name;
    const issueTypesThatSupportSubtasks = ['Task', 'Story', 'Bug', 'Epic'];

    if (!issueTypesThatSupportSubtasks.includes(parentIssueType)) {
      res.status(400).json({
        error: `The parent issue type '${parentIssueType}' does not support subtasks.`,
      });
      return;
    }

    // Fetch create metadata to get the issue type ID for 'Sub-task' or 'Deloppgave'
    const projectKey = parentIssue.fields.project.key;
    const createMeta = await jira.getIssueCreateMetadata({
      projectKeys: [projectKey],
      expand: 'projects.issuetypes.fields',
    });

    console.log('Create Metadata:', JSON.stringify(createMeta, null, 2));

    // Find the issue type ID for 'Sub-task' or 'Deloppgave'
    let subtaskIssueTypeId: string | undefined;
    const projectMeta = createMeta.projects.find(
      (proj: any) => proj.key === projectKey
    );

    if (projectMeta) {
      const subtaskIssueType = projectMeta.issuetypes.find(
        (it: any) => it.name.toLowerCase() === 'sub-task' || it.name.toLowerCase() === 'deloppgave'
      );
      if (subtaskIssueType) {
        subtaskIssueTypeId = subtaskIssueType.id;
      }
    }

    if (!subtaskIssueTypeId) {
      res.status(400).json({
        error: "Neither 'Sub-task' nor 'Deloppgave' issue type found in the project. Ensure that the correct issue type is available in the project's issue type scheme.",
      });
      return;
    }

    // Create a new subtask under the parent issue
    const newSubtask = await jira.addNewIssue({
      fields: {
        project: {
          key: projectKey,
        },
        parent: {
          key: parentIssueKey,
        },
        summary: subtaskIssue.fields.summary,
        description: subtaskIssue.fields.description,
        issuetype: {
          id: subtaskIssueTypeId,
        },
      },
    });

    // Delete the original issue if subtask creation is successful
    await jira.deleteIssue(subtaskIssueKey);

    res.status(200).json({
      message: 'Issue converted to subtask successfully.',
      newSubtaskKey: newSubtask.key,
    });
  } catch (error: any) {
    console.error('Error making subtask:', error?.response?.data || error);
    res.status(500).json({
      error: error?.response?.data?.errors || error.message || 'Failed to make subtask.',
    });
  }
}
