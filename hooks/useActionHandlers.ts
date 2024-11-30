// hooks/useActionHandlers.ts

import { useState } from 'react';
import axios from 'axios';
import {
  ActionSuggestion,
  ActionType,
  DuplicateGroup,
  JiraIssue,
  Subtask,
  SubtaskAction,
  Suggestion,
} from '../types/types';
import { useJira } from '../context/JiraContext';
import { useToast, useDisclosure } from '@chakra-ui/react';

export function useActionHandlers(
  fetchIssuesData: () => Promise<void>,
  issues: JiraIssue[],
  setIssues: React.Dispatch<React.SetStateAction<JiraIssue[]>>,
  setDuplicates: React.Dispatch<React.SetStateAction<DuplicateGroup[]>>
) {
  const { config } = useJira();
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [suggestion, setSuggestion] = useState<ActionSuggestion | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[] | null>(null);
  const toast = useToast();
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);

  const {
    isOpen: isConfirmationOpen,
    onOpen: onConfirmationOpen,
    onClose: onConfirmationClose,
  } = useDisclosure();

  const {
    isOpen: isSubtaskModalOpen,
    onOpen: onSubtaskModalOpen,
    onClose: onSubtaskModalClose,
  } = useDisclosure();

  /**
   * Handles the user's action based on the selected option and action type.
   * @param selectedOption - The user's selected option ('recommendation' or 'markAsDuplicate').
   */
  const handleAction = async (selectedOption?: 'recommendation' | 'markAsDuplicate') => {
    if (!selectedGroup || !actionType || !config) return;

    setActionInProgress(true);
    try {
      if (actionType === 'merge') {
        if (selectedOption === 'recommendation' && suggestion) {
          const actionNumber = suggestion.action;

          switch (actionNumber) {
            case 1:
              console.log('Executing Action 1: Delete One Issue and Keep the Other');
              await performDeleteOneIssue(suggestion.keepIssueKey!, suggestion.deleteIssueKey!);
              break;
            case 2:
              console.log('Executing Action 2: Delete Both Issues and Create New');
              await performDeleteBothAndCreateNew(
                suggestion.deleteIssueKeys!,
                suggestion.createIssueSummary!,
                suggestion.createIssueDescription!
              );
              break;
            case 3:
              console.log('Executing Action 3: Make One Issue a Subtask of the Other');
              await performMakeSubtask(suggestion.parentIssueKey!, suggestion.subtaskIssueKey!);
              break;
            case 4:
              console.log('Executing Action 4: Suggest Ignoring but Offer to Mark as Duplicates');
              await handleIgnoreAndOfferDuplicateMarking(selectedGroup.group);
              break;
            default:
              console.warn(`Recommendation not implemented. Proceeding to default action.`);
              toast({
                title: `Recommendation not implemented. Proceeding to default action.`,
                status: 'warning',
                duration: 3000,
                isClosable: true,
              });
          }
        } else {
          console.log('No recommendation available. Proceeding to handle manually.');
        }

        setDuplicates((prev) => prev.filter((group) => group !== selectedGroup));
      } else if (actionType === 'notDuplicate' || actionType === 'ignore') {
        console.log(`Action Type: ${actionType}. Proceeding to remove from duplicates.`);
        setDuplicates((prev) => prev.filter((group) => group !== selectedGroup));
      }
    } catch (error) {
      console.error('Error performing action:', error);
      toast({
        title: 'An error occurred while performing the action.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setActionInProgress(false);
      setSelectedGroup(null);
      setActionType(null);
      setSuggestion(null);
      onConfirmationClose();
    }
  };

  /**
   * Deletes one issue and keeps the other.
   * @param keepIssueKey - The key of the issue to keep.
   * @param deleteIssueKey - The key of the issue to delete.
   */
   const performDeleteOneIssue = async (keepIssueKey: string, deleteIssueKey: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete issue ${deleteIssueKey} and keep issue ${keepIssueKey}?`
    );
    if (!confirmDelete) return;
  
    try {
      const deleteSuccess = await handleDeleteIssueResponse(deleteIssueKey);
      if (deleteSuccess) {
        toast({
          title: `Issue ${deleteIssueKey} has been deleted. Issue ${keepIssueKey} has been kept.`,
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Deletion failed or requires subtask handling
        // Handle accordingly or let the user know
      }
    } catch (error: any) {
      console.error('Error deleting issue:', error);
      toast({
        title: 'Failed to delete issue.',
        description: error.response?.data?.error || 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  

  /**
   * Deletes both issues and creates a new, better-formulated issue.
   * @param deleteIssueKeys - Keys of issues to delete.
   * @param createIssueSummary - Summary for the new issue.
   * @param createIssueDescription - Description for the new issue.
   */
  const performDeleteBothAndCreateNew = async (
    deleteIssueKeys: string[],
    createIssueSummary: string,
    createIssueDescription: string
  ) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete issues ${deleteIssueKeys.join(
        ', '
      )} and create a new issue with the following summary:\n"${createIssueSummary}"?`
    );
    if (!confirmDelete) return;

    try {
      // Fetch details of the issues being deleted to construct the description if not provided
      const issuesToDelete = issues.filter((issue) => deleteIssueKeys.includes(issue.key));

      // Construct a combined description from the deleted issues if not provided
      const description =
        createIssueDescription ||
        issuesToDelete.map((issue) => `- ${issue.fields.summary}`).join('\n');

      const issuetype = 'Task'; // Modify as needed or derive dynamically

      const newSuggestion: Suggestion = {
        summary: createIssueSummary,
        description: description,
        issuetype: issuetype,
      };

      // Create the new issue by sending the Suggestion object
      const response = await axios.post('/api/create-issue', {
        suggestion: newSuggestion,
        isEpic: false,
        config,
      });

      const newIssue = response.data.issue;

      // Add the new issue to local state
      setIssues((prevIssues) => [newIssue, ...prevIssues]);

      toast({
        title: `New issue ${newIssue.key} has been created successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Delete the original issues
      for (const issueKey of deleteIssueKeys) {
        await handleDeleteIssueResponse(issueKey, false);
      }

      // No need to call fetchIssuesData(); state is updated
    } catch (error: any) {
      console.error('Error performing delete and create action:', error);
      toast({
        title: 'Failed to perform the delete and create action.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Makes one issue a subtask of the other.
   * @param parentIssueKey - The key of the parent issue.
   * @param subtaskIssueKey - The key of the issue to convert into a subtask.
   */
  const performMakeSubtask = async (parentIssueKey: string, subtaskIssueKey: string) => {
    const issue = issues.find((issue) => issue.key === subtaskIssueKey);
    let hasSubtasks = false;

    if (issue?.fields.subtasks && issue.fields.subtasks.length > 0) {
      hasSubtasks = true;
    }

    let confirmAction = true;
    if (hasSubtasks) {
      confirmAction = window.confirm(
        `Issue ${subtaskIssueKey} has subtasks. Converting it to a subtask will reassign its subtasks to the parent issue ${parentIssueKey}. Do you want to proceed?`
      );
    } else {
      confirmAction = window.confirm(
        `Are you sure you want to convert issue ${subtaskIssueKey} into a subtask of issue ${parentIssueKey}? This will nest ${subtaskIssueKey} under ${parentIssueKey}.`
      );
    }

    if (!confirmAction) return;

    try {
      await axios.post('/api/make-subtask', {
        subtaskIssueKey: subtaskIssueKey,
        parentIssueKey: parentIssueKey,
        config,
      });

      // Fetch the updated issue details
      const response = await axios.post('/api/get-issue', {
        issueKey: subtaskIssueKey,
        config,
      });
      const updatedIssue = response.data.issue;

      // Update the issue in local state
      setIssues((prevIssues) =>
        prevIssues.map((issue) => (issue.key === subtaskIssueKey ? updatedIssue : issue))
      );

      toast({
        title: `Issue ${subtaskIssueKey} has been converted into a subtask of ${parentIssueKey}.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // No need to call fetchIssuesData(); state is updated
    } catch (error: any) {
      console.error('Error converting to subtask:', error);
      toast({
        title: 'Failed to convert issue to subtask.',
        description: error.response?.data?.error || 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Handles ignoring issues but offering to mark them as duplicates in Jira.
   * @param issuesToIgnore - Array of JiraIssue to ignore.
   */
  const handleIgnoreAndOfferDuplicateMarking = async (issuesToIgnore: JiraIssue[]) => {
    const confirmIgnore = window.confirm(
      'Do you want to ignore these issues? You can still mark them as duplicates in Jira later.'
    );
    if (!confirmIgnore) return;

    try {
      // Optionally, implement any logic for ignoring issues here
      toast({
        title: 'Issues have been ignored.',
        description: 'You can mark them as duplicates in Jira at any time.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });

      // Offer to mark as duplicates now
      const confirmMarkDuplicates = window.confirm(
        'Would you like to mark these issues as duplicates in Jira now?'
      );
      if (confirmMarkDuplicates) {
        await markIssuesAsDuplicates(issuesToIgnore, ''); // Pass empty string if no new issue key
      }

      setDuplicates((prev) => prev.filter((group) => group !== selectedGroup));
    } catch (error: any) {
      console.error('Error handling ignore and duplicate marking:', error);
      toast({
        title: 'Failed to handle ignore action.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Marks issues as duplicates in Jira by linking them to a source issue.
   * @param issuesToMark - Array of JiraIssue to mark as duplicates.
   * @param sourceIssueKey - The key of the source issue to which duplicates will be linked. If empty, prompt the user.
   */
  const markIssuesAsDuplicates = async (
    issuesToMark: JiraIssue[],
    sourceIssueKey: string
  ) => {
    let sourceKey = sourceIssueKey;

    if (!sourceKey) {
      // Prompt the user to select a source issue
      const selectedSource = window.prompt(
        `Enter the source issue key to which the following issues will be marked as duplicates:\n${issuesToMark
          .map((issue) => issue.key)
          .join(', ')}`
      );
      if (!selectedSource) {
        toast({
          title: 'Duplicate marking cancelled.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      sourceKey = selectedSource.trim();
    }

    try {
      const targetKeys = issuesToMark.map((issue) => issue.key);
      const response = await axios.post('/api/link-issues', {
        sourceIssueKey: sourceKey,
        targetIssueKeys: targetKeys,
        config,
      });
      if (response.status === 200) {
        toast({
          title: `Issues ${targetKeys.join(', ')} have been marked as duplicates of ${sourceKey} in Jira.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        // Update local state if needed
      } else {
        throw new Error(response.data.error || 'Failed to link issues.');
      }
    } catch (error: any) {
      console.error('Error linking issues as duplicates:', error);
      toast({
        title: 'Failed to mark issues as duplicates.',
        description: error.response?.data?.error || 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  /**
   * Deletes a Jira issue by calling the backend API.
   * @param issueKey - The key of the issue to delete.
   * @param confirmPrompt - Whether to show confirmation prompt (default true).
   * @param onSuccess - Callback to execute on successful deletion.
   */
   const handleDeleteIssueResponse = async (
    issueKey: string,
    confirmPrompt: boolean = true,
    onSuccess?: () => void
  ): Promise<boolean> => {
    const proceed = confirmPrompt
      ? window.confirm(`Are you sure you want to delete issue ${issueKey}?`)
      : true;
    if (!proceed) return false;
  
    setActionInProgress(true);
    try {
      const response = await axios.post('/api/delete-issue', { issueKey, config });
  
      if (response.status === 200) {
        setIssues((prevIssues) => prevIssues.filter((issue) => issue.key !== issueKey));
  
        toast({
          title: `Issue ${issueKey} deleted successfully.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        if (onSuccess) {
          onSuccess();
        }
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete issue.');
      }
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.subtasks) {
        setSubtasks(error.response.data.subtasks);
        setSelectedIssueKey(issueKey);
        onSubtaskModalOpen();
      } else {
        console.error('Error deleting issue:', error);
        toast({
          title: 'Failed to delete issue.',
          description: error.response?.data?.error || 'Please try again later.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      return false;
    } finally {
      setActionInProgress(false);
    }
  };
  

  /**
   * Handles actions related to subtasks (delete or convert).
   * @param subtaskActions - Array of actions to perform on subtasks.
   */
  const handleSubtaskAction = async (subtaskActions: SubtaskAction[]) => {
    if (!selectedIssueKey) return;

    setActionInProgress(true);
    try {
      await axios.post('/api/delete-issue', {
        issueKey: selectedIssueKey,
        subtaskActions,
        config,
      });

      // Remove the main issue from local state
      setIssues((prevIssues) => prevIssues.filter((issue) => issue.key !== selectedIssueKey));

      // Update or remove subtasks based on actions
      for (const action of subtaskActions) {
        if (action.action === 'delete') {
          setIssues((prevIssues) => prevIssues.filter((issue) => issue.key !== action.subtaskKey));
        } else if (action.action === 'convert') {
          // Fetch the updated issue and update local state
          const response = await axios.post('/api/get-issue', {
            issueKey: action.subtaskKey,
            config,
          });
          const updatedIssue = response.data.issue;

          setIssues((prevIssues) =>
            prevIssues.map((issue) => (issue.key === action.subtaskKey ? updatedIssue : issue))
          );
        }
      }

      toast({
        title: `Issue ${selectedIssueKey} and specified subtasks have been processed successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // No need to call fetchIssuesData(); state is updated
      onSubtaskModalClose();
    } catch (error: any) {
      console.error('Error processing subtasks:', error);
      toast({
        title: 'Failed to process subtasks.',
        description: error.response?.data?.error || 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setActionInProgress(false);
      setSubtasks(null);
      setSelectedIssueKey(null);
    }
  };

  const onExplain = async (issueKey: string): Promise<string> => {
    try {
      const response = await axios.post('/api/explain-issue', { issueKey, config });
      return response.data.explanation;
    } catch (error) {
      console.error('Error fetching explanation:', error);
      toast({
        title: 'Failed to fetch explanation',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return 'Failed to fetch explanation.';
    }
  };

  // 2. Fetch a suggested summary for an issue
  const onSuggestSummary = async (issueKey: string): Promise<string> => {
    try {
      const response = await axios.post('/api/suggest-new-summary', { issueKey, config });
      return response.data.suggestedSummary;
    } catch (error) {
      console.error('Error fetching suggested summary:', error);
      toast({
        title: 'Failed to fetch suggested summary',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return 'Failed to fetch suggested summary.';
    }
  };

  // 3. Update the summary of an issue
  const onEditSummary = async (issueKey: string, newSummary: string): Promise<void> => {
    try {
      await axios.post('/api/edit-issue-summary', { issueKey, newSummary, config });
      // Update the issue in local state
      setIssues((prevIssues) =>
        prevIssues.map((issue) =>
          issue.key === issueKey ? { ...issue, fields: { ...issue.fields, summary: newSummary } } : issue
        )
      );

      toast({
        title: 'Summary updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // No need to fetchIssuesData(); state is updated
    } catch (error) {
      console.error('Error updating summary:', error);
      toast({
        title: 'Failed to update summary',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return {
    actionInProgress,
    selectedGroup,
    actionType,
    suggestion,
    subtasks,
    isConfirmationOpen,
    onConfirmationOpen,
    onConfirmationClose,
    isSubtaskModalOpen,
    onSubtaskModalOpen,
    onSubtaskModalClose,
    handleAction,
    handleSubtaskAction,
    handleDeleteIssueResponse,
    onExplain,
    onSuggestSummary,
    onEditSummary,
    setSubtasks,
  };
}
