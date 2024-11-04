// app/page.tsx

'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  List,
  ListItem,
  Spinner,
  Alert,
  AlertIcon,
  Button,
  ButtonGroup,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
  HStack,
  useToast,
  Divider,
} from '@chakra-ui/react';
import axios from 'axios';
import { ActionSuggestion, DuplicateGroup, JiraIssue, Suggestion, ActionType } from '../types/types'; // Ensure correct import path
import JiraConfigForm from '../components/JiraConfigForm'; // Import the form component
import { useJira } from '../context/JiraContext'; // Import the context

interface JiraConfig {
  jiraEmail: string;
  jiraApiToken: string;
  jiraBaseUrl: string;
  projectKey: string;
}

export default function HomePage() {
  const { config } = useJira();
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [duplicateLoading, setDuplicateLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duplicateError, setDuplicateError] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [suggestion, setSuggestion] = useState<ActionSuggestion | null>(null);
  const [subtasks, setSubtasks] = useState<JiraIssue[] | null>(null);
  const [deleteAction, setDeleteAction] = useState<'delete' | 'convert' | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState<boolean>(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  /**
   * Fetches Jira issues from the backend API.
   */
  const fetchIssues = async (config: JiraConfig) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/issues', { config });
      setIssues(response.data.issues);
      setDuplicates([]);
      toast({
        title: 'Issues fetched successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error('Error fetching issues:', err);
      setError('Failed to fetch Jira issues. Please check your configuration.');
      toast({
        title: 'Error fetching issues.',
        description: 'Please check your Jira configuration and try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Detects duplicate issues by calling the backend API.
   */
  const detectDuplicates = async () => {
    if (!config) {
      setDuplicateError('Please configure your Jira settings first.');
      return;
    }

    setDuplicateLoading(true);
    setDuplicateError('');
    try {
      const response = await axios.post('/api/detect-duplicates', { issues, config });
      setDuplicates(response.data.duplicates);
      toast({
        title: 'Duplicate detection completed.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error('Error detecting duplicates:', err);
      setDuplicateError('Failed to detect duplicates: ' + (err.response?.data?.error || err.message));
      toast({
        title: 'Error detecting duplicates.',
        description: 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setDuplicateLoading(false);
    }
  };

  /**
   * Suggests new issues based on the project description by calling the backend API.
   */
  const suggestNewIssues = async () => {
    if (!config) {
      setError('Please configure your Jira settings first.');
      return;
    }

    setSuggesting(true);
    setError('');
    try {
      const response = await axios.post('/api/suggest-new-issues', {
        projectDescription,
        config,
      });
      setSuggestions(response.data.suggestions);
      toast({
        title: 'New issues suggested successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error('Error suggesting new issues:', err);
      setError('Failed to suggest new issues: ' + (err.response?.data?.error || err.message));
      toast({
        title: 'Error suggesting new issues.',
        description: 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSuggesting(false);
    }
  };

  /**
   * Creates a new issue in Jira by calling the backend API.
   * @param suggestion - The suggestion to create.
   * @param isEpic - Whether the issue is an Epic.
   */
  const createIssueInJira = async (suggestion: Suggestion, isEpic: boolean = false) => {
    if (!config) {
      toast({
        title: 'Jira configuration missing.',
        description: 'Please configure your Jira settings first.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const response = await axios.post('/api/create-issue', { suggestion, isEpic, config });
      toast({
        title: `Issue ${response.data.issueKey} created successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchIssues(config as JiraConfig);
    } catch (err: any) {
      console.error('Error creating issue:', err);
      toast({
        title: 'Failed to create issue.',
        description: err.response?.data?.error || 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

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
            // Implement a default action if necessary
          }
        } else {
          console.log('No recommendation available. Proceeding to handle manually.');
          // Implement default action if necessary
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
      onClose();
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
      await handleDeleteIssueResponse(deleteIssueKey);
      toast({
        title: `Issue ${deleteIssueKey} has been deleted. Issue ${keepIssueKey} has been kept.`,
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting issue:', error);
      toast({
        title: 'Failed to delete issue.',
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
      `Are you sure you want to delete issues ${deleteIssueKeys.join(', ')} and create a new issue with the following summary:\n"${createIssueSummary}"?`
    );
    if (!confirmDelete) return;

    try {
      // Fetch details of the issues being deleted to construct the description if not provided
      const issuesToDelete = issues.filter((issue) => deleteIssueKeys.includes(issue.key));

      // Construct a combined description from the deleted issues if not provided
      const description = createIssueDescription || issuesToDelete.map(issue => `- ${issue.fields.summary}`).join('\n');

      const issuetype = 'Task'; // Modify as needed or derive dynamically

      const suggestion: Suggestion = {
        summary: createIssueSummary,
        description: description,
        issuetype: issuetype,
      };

      // Create the new issue by sending the Suggestion object
      const response = await axios.post('/api/create-issue', { suggestion, isEpic: false, config });

      toast({
        title: `New issue ${response.data.issueKey} has been created successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Optionally, mark the original issues as duplicates in Jira
      const confirmMarkDuplicates = window.confirm('Would you like to mark the deleted issues as duplicates of the new issue in Jira?');
      if (confirmMarkDuplicates) {
        await markIssuesAsDuplicates(issuesToDelete, response.data.issueKey);
      }

      fetchIssues(config as JiraConfig);
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
    const confirmAction = window.confirm(
      `Are you sure you want to convert issue ${subtaskIssueKey} into a subtask of issue ${parentIssueKey}? This will remove ${subtaskIssueKey} from the top-level and nest it under ${parentIssueKey}.`
    );
    if (!confirmAction) return;

    try {
      await axios.post('/api/make-subtask', {
        subtaskIssueKey: subtaskIssueKey,
        parentIssueKey: parentIssueKey,
        config,
      });
      toast({
        title: `Issue ${subtaskIssueKey} has been converted into a subtask of ${parentIssueKey}.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchIssues(config as JiraConfig);
    } catch (error: any) {
      console.error('Error converting to subtask:', error);
      toast({
        title: 'Failed to convert issue to subtask.',
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
      const confirmMarkDuplicates = window.confirm('Would you like to mark these issues as duplicates in Jira now?');
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
  const markIssuesAsDuplicates = async (issuesToMark: JiraIssue[], sourceIssueKey: string) => {
    let sourceKey = sourceIssueKey;

    if (!sourceKey) {
      // Prompt the user to select a source issue
      const selectedSource = window.prompt(`Enter the source issue key to which the following issues will be marked as duplicates:\n${issuesToMark.map(issue => issue.key).join(', ')}`);
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
      const targetKeys = issuesToMark.map(issue => issue.key);
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
        fetchIssues(config as JiraConfig);
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
   * Opens the confirmation modal and fetches action suggestions if merging.
   * @param group - The group of duplicate issues selected.
   * @param type - The type of action ('merge', 'notDuplicate', 'ignore').
   */
  const openConfirmationModal = async (
    group: DuplicateGroup,
    type: ActionType
  ) => {
    setSelectedGroup(group);
    setActionType(type);

    if (type === 'merge') {
      try {
        const response = await axios.post('/api/suggest-action', {
          issues: group.group,
          config,
        });
        const data = response.data.suggestion as ActionSuggestion;
        setSuggestion(data);
      } catch (error) {
        console.error('Error getting action suggestion:', error);
        setSuggestion(null);
        toast({
          title: 'An error occurred while getting the action suggestion.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } else {
      setSuggestion(null);
    }

    onOpen();
  };

  /**
   * Handles actions related to subtasks (delete or convert).
   * @param parentIssueKey - The key of the parent issue.
   * @param action - The action to perform ('delete' or 'convert').
   */
  const handleSubtaskAction = async (parentIssueKey: string, action: 'delete' | 'convert') => {
    if (!subtasks || subtasks.length === 0 || !config) return;

    setActionInProgress(true);
    try {
      if (action === 'delete') {
        // Delete all subtasks
        for (const subtask of subtasks) {
          await handleDeleteIssueResponse(subtask.key);
        }
        toast({
          title: `All subtasks of ${parentIssueKey} have been deleted.`,
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      } else if (action === 'convert') {
        // Convert all subtasks to separate tasks
        for (const subtask of subtasks) {
          await axios.post('/api/convert-to-task', {
            issueKey: subtask.key,
            config,
          });
        }
        toast({
          title: `All subtasks of ${parentIssueKey} have been converted to separate tasks.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        fetchIssues(config as JiraConfig);
      }
    } catch (error: any) {
      console.error(`Error performing subtask action (${action}):`, error);
      toast({
        title: `Failed to ${action} subtasks.`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setActionInProgress(false);
      setSubtasks(null);
      onClose();
    }
  };

  /**
   * Deletes a Jira issue by calling the backend API.
   * @param issueKey - The key of the issue to delete.
   */
  const handleDeleteIssueResponse = async (issueKey: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete issue ${issueKey}?`);
    if (!confirmDelete) return;

    setActionInProgress(true);
    try {
      await axios.post('/api/delete-issue', { issueKey, config });
      toast({
        title: `Issue ${issueKey} deleted successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchIssues(config as JiraConfig);
    } catch (error: any) {
      console.error('Error deleting issue:', error);
      toast({
        title: 'Failed to delete issue.',
        description: error.response?.data?.error || 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setActionInProgress(false);
    }
  };

  useEffect(() => {
    if (config) {
      fetchIssues(config as JiraConfig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Render the main content only if the Jira configuration is valid
  return (
    <Box p={4}>
      <Heading mb={4}>Jira Backlog Manager</Heading>

      {/* Jira Configuration Form */}
      {!config ? (
        <JiraConfigForm />
      ) : (
        <>
          {/* Suggest New Issues Section */}
          <Box mb={6}>
            <Heading size="md" mb={2}>
              Suggest New Issues
            </Heading>
            <Textarea
              placeholder="Enter project description..."
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              mb={2}
            />
            <Button onClick={suggestNewIssues} isLoading={suggesting} colorScheme="teal">
              Suggest New Issues
            </Button>
          </Box>

          <HStack spacing={4} justify="center">
            <Button colorScheme="teal" onClick={() => fetchIssues(config as JiraConfig)} isLoading={loading}>
              Refresh Issues
            </Button>
            <Button
              colorScheme="blue"
              onClick={detectDuplicates}
              isLoading={duplicateLoading}
              disabled={issues.length === 0}
            >
              Detect Duplicates
            </Button>
          </HStack>

          {error && (
            <Alert status="error" mb={4}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          {duplicates.length > 0 && (
            <Box mb={4}>
              <Heading size="md">Potential Duplicate Pairs</Heading>
              {duplicates.map((dupGroup, index) => (
                <Box key={index} borderWidth="1px" borderRadius="md" p={4} mb={2}>
                  <Text fontWeight="bold">Pair {index + 1}</Text>
                  <Text fontStyle="italic" mb={2}>
                    {dupGroup.explanation}
                  </Text>
                  <List spacing={2} mt={2}>
                    {dupGroup.group.map((issue) => (
                      <ListItem key={issue.id}>
                        {issue.key}: {issue.fields.summary}
                      </ListItem>
                    ))}
                  </List>
                  <ButtonGroup mt={4}>
                    <Button
                      colorScheme="blue"
                      onClick={() => openConfirmationModal(dupGroup, 'merge')}
                      isLoading={actionInProgress}
                    >
                      Merge Issues
                    </Button>
                    <Button onClick={() => openConfirmationModal(dupGroup, 'notDuplicate')}>
                      Not Duplicates
                    </Button>
                    <Button variant="ghost" onClick={() => openConfirmationModal(dupGroup, 'ignore')}>
                      Ignore
                    </Button>
                  </ButtonGroup>
                </Box>
              ))}
            </Box>
          )}

          <Heading size="md" mt={6}>
            All Issues
          </Heading>
          {issues.length === 0 ? (
            <Text>No issues found.</Text>
          ) : (
            <List spacing={3} mt={2}>
              {issues.map((issue) => (
                <ListItem key={issue.id} borderWidth="1px" borderRadius="md" p={4}>
                  <Text fontWeight="bold">
                    {issue.key}: {issue.fields.summary}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    Type: {issue.fields.issuetype.name} | Created:{' '}
                    {new Date(issue.fields.created).toLocaleDateString()}
                  </Text>
                  <Button
                    mt={2}
                    colorScheme="red"
                    onClick={() => handleDeleteIssueResponse(issue.key)}
                    isLoading={actionInProgress}
                  >
                    Delete Issue
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Action</ModalHeader>
          <ModalBody>
            {subtasks && subtasks.length > 0 ? (
              <Box>
                <Text mb={4}>
                  The issue has the following subtasks. Do you want to delete them as well or convert them into separate tasks?
                </Text>
                <List spacing={2} mb={4}>
                  {subtasks.map((subtask) => (
                    <ListItem key={subtask.id}>
                      {subtask.key}: {subtask.fields.summary}
                    </ListItem>
                  ))}
                </List>
                <ButtonGroup mt={4}>
                  <Button
                    colorScheme="red"
                    onClick={() => {
                      setDeleteAction('delete');
                      handleSubtaskAction(subtasks[0].fields.parent?.key || '', 'delete');
                    }}
                    isLoading={actionInProgress}
                  >
                    Delete Subtasks
                  </Button>
                  <Button
                    colorScheme="blue"
                    onClick={() => {
                      setDeleteAction('convert');
                      handleSubtaskAction(subtasks[0].fields.parent?.key || '', 'convert');
                    }}
                    isLoading={actionInProgress}
                  >
                    Convert to Tasks
                  </Button>
                </ButtonGroup>
              </Box>
            ) : actionType === 'merge' && selectedGroup ? (
              <Box>
                <Text mb={4}>You have selected to merge the following issues:</Text>
                <List spacing={2} mb={4}>
                  {selectedGroup.group.map((issue) => (
                    <ListItem key={issue.id}>
                      {issue.key}: {issue.fields.summary}
                    </ListItem>
                  ))}
                </List>
                {suggestion ? (
                  <Box>
                    <Text mb={2} fontWeight="bold">
                      GPT-4 Recommendation (Action {suggestion.action}):
                    </Text>
                    <Text mb={4}>{suggestion.description}</Text>
                    {suggestion.action === 1 && suggestion.keepIssueKey && suggestion.deleteIssueKey ? (
                      <Box>
                        <Text>
                          <strong>Keep Issue:</strong> {suggestion.keepIssueKey}
                        </Text>
                        <Text>
                          <strong>Delete Issue:</strong> {suggestion.deleteIssueKey}
                        </Text>
                      </Box>
                    ) : suggestion.action === 2 && suggestion.deleteIssueKeys && suggestion.createIssueSummary && suggestion.createIssueDescription ? (
                      <Box>
                        <Text>
                          <strong>Delete Issues:</strong> {suggestion.deleteIssueKeys.join(', ')}
                        </Text>
                        <Text>
                          <strong>Create New Issue Summary:</strong> {suggestion.createIssueSummary}
                        </Text>
                        <Text>
                          <strong>Create New Issue Description:</strong> {suggestion.createIssueDescription}
                        </Text>
                      </Box>
                    ) : suggestion.action === 3 && suggestion.parentIssueKey && suggestion.subtaskIssueKey ? (
                      <Box>
                        <Text>
                          <strong>Parent Issue:</strong> {suggestion.parentIssueKey}
                        </Text>
                        <Text>
                          <strong>Subtask Issue:</strong> {suggestion.subtaskIssueKey}
                        </Text>
                      </Box>
                    ) : suggestion.action === 4 ? (
                      <Box>
                        <Text>
                          <strong>Ignore Issues:</strong> {suggestion.description}
                        </Text>
                        <Text mt={2}>
                          You can mark these issues as duplicates in Jira manually if needed.
                        </Text>
                      </Box>
                    ) : null}
                    <Text mt={4}>
                      You can proceed with this recommendation or choose to manually handle the issues.
                    </Text>
                  </Box>
                ) : (
                  <Text>
                    Unable to retrieve recommendation. You can proceed to handle the issues manually.
                  </Text>
                )}
                <Text mt={4} fontWeight="bold">
                  Do you wish to proceed?
                </Text>
              </Box>
            ) : (actionType === 'notDuplicate' || actionType === 'ignore') && selectedGroup ? (
              <Box>
                <Text mb={4}>
                  You are about to{' '}
                  {actionType === 'notDuplicate'
                    ? 'mark the following issues as not duplicates'
                    : 'ignore the duplicate suggestion for the following issues'}
                  :
                </Text>
                <List spacing={2} mb={4}>
                  {selectedGroup.group.map((issue) => (
                    <ListItem key={issue.id}>
                      {issue.key}: {issue.fields.summary}
                    </ListItem>
                  ))}
                </List>
                <Text>
                  This will remove the duplicate suggestion from the list. No changes will be made to the issues in Jira.
                </Text>
                <Text mt={4} fontWeight="bold">
                  Do you wish to proceed?
                </Text>
              </Box>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSubtasks(null);
                onClose();
              }}
              mr={3}
            >
              Cancel
            </Button>
            {subtasks && subtasks.length > 0 ? null : actionType === 'merge' && selectedGroup ? (
              <ButtonGroup>
                {suggestion?.action === 1 && suggestion.keepIssueKey && suggestion.deleteIssueKey ? (
                  <Button
                    colorScheme="green"
                    onClick={() => handleAction('recommendation')}
                    isLoading={actionInProgress}
                  >
                    Accept Recommendation
                  </Button>
                ) : suggestion?.action === 2 && suggestion.deleteIssueKeys && suggestion.createIssueSummary && suggestion.createIssueDescription ? (
                  <Button
                    colorScheme="green"
                    onClick={() => handleAction('recommendation')}
                    isLoading={actionInProgress}
                  >
                    Accept Recommendation
                  </Button>
                ) : suggestion?.action === 3 && suggestion.parentIssueKey && suggestion.subtaskIssueKey ? (
                  <Button
                    colorScheme="green"
                    onClick={() => handleAction('recommendation')}
                    isLoading={actionInProgress}
                  >
                    Accept Recommendation
                  </Button>
                ) : suggestion?.action === 4 ? (
                  <Button
                    colorScheme="green"
                    onClick={() => handleAction('recommendation')}
                    isLoading={actionInProgress}
                  >
                    Ignore Issues
                  </Button>
                ) : null}
                <Button
                  colorScheme="blue"
                  onClick={() => handleAction('markAsDuplicate')}
                  isLoading={actionInProgress}
                >
                  Mark as Duplicates in Jira
                </Button>
              </ButtonGroup>
            ) : actionType === 'merge' && !suggestion ? (
              <Button
                colorScheme="blue"
                onClick={() => handleAction('markAsDuplicate')}
                isLoading={actionInProgress}
              >
                Handle Manually
              </Button>
            ) : actionType === 'notDuplicate' || actionType === 'ignore' ? (
              <Button
                colorScheme="blue"
                onClick={() => handleAction()}
                isLoading={actionInProgress}
              >
                Confirm
              </Button>
            ) : null}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
