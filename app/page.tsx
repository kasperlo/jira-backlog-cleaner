// app/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
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
  CircularProgress,
  CircularProgressLabel,
  VStack,
  Tooltip,
} from '@chakra-ui/react';
import axios from 'axios';
import {
  ActionSuggestion,
  DuplicateGroup,
  JiraIssue,
  Suggestion,
  ActionType,
} from '../types/types';
import JiraConfigForm from '../components/JiraConfigForm';
import { useJira } from '../context/JiraContext';

interface JiraConfig {
  jiraEmail: string;
  jiraApiToken: string;
  jiraBaseUrl: string;
  projectKey: string;
}

interface ProgressData {
  total: number;
  completed: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export default function HomePage() {
  const { config } = useJira();
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [duplicateLoading, setDuplicateLoading] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData>({
    total: 0,
    completed: 0,
    status: 'idle',
  });
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
  const [progressPercentage, setProgressPercentage] = useState<number>(0);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startProcessing = async () => {
    if (!config) {
      toast({
        title: 'Jira configuration missing.',
        description: 'Please configure your Jira settings first.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setProcessing(true);
    setProgress({
      total: 0,
      completed: 0,
      status: 'processing',
    });
    setIssues([]);
    setError('');

    try {
      const response = await axios.post('/api/issues', {
        config,
        action: 'process',
      });

      if (response.status === 202) {
        toast({
          title: 'Processing Started',
          description: 'Issue processing has begun.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });

        // Start polling progress and issues
        startPolling();
      } else {
        throw new Error('Failed to start processing.');
      }
    } catch (error: any) {
      console.error('Error starting processing:', error);
      setProcessing(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start processing.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const startPolling = () => {
    // Clear any existing intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Fetch progress
        const progressResponse = await axios.get('/api/progress');
        const progressData: ProgressData = progressResponse.data;
        setProgress(progressData);

        // Update progress percentage
        const percentage =
          progressData.total > 0 ? (progressData.completed / progressData.total) * 100 : 0;
        setProgressPercentage(percentage);

        // Fetch processed issues
        const issuesResponse = await axios.post('/api/issues', {
          config,
          action: 'fetchProcessedIssues',
        });
        setIssues(issuesResponse.data.issues || []);

        // Check if processing is completed or errored
        if (progressData.status === 'completed') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          setProcessing(false);
          toast({
            title: 'Processing Completed',
            description: 'All issues have been processed successfully.',
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        } else if (progressData.status === 'error') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          setProcessing(false);
          toast({
            title: 'Processing Error',
            description: progressData.errorMessage || 'An error occurred during processing.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error('Error during polling:', error);
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        setProcessing(false);
        toast({
          title: 'Error',
          description: 'An error occurred during polling.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }, 2000); // Poll every 2 seconds
  };

  /**
   * Detects duplicate issues by calling the backend API.
   */
  const detectDuplicates = async () => {
    if (!config) {
      setError('Please configure your Jira settings first.');
      return;
    }

    setDuplicateLoading(true);
    setDuplicateError('');
    try {
      const response = await axios.post('/api/detect-duplicates', { issues, config });
      setDuplicates(response.data.duplicates || []);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

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
          await handleDeleteIssueResponse(subtask.key, false); // Pass false to skip confirmation
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
        fetchIssuesData();
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

      const newSuggestion: Suggestion = {
        summary: createIssueSummary,
        description: description,
        issuetype: issuetype,
      };

      // Create the new issue by sending the Suggestion object
      const response = await axios.post('/api/create-issue', { suggestion: newSuggestion, isEpic: false, config });

      toast({
        title: `New issue ${response.data.issueKey} has been created successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Delete the original issues
      for (const issueKey of deleteIssueKeys) {
        await handleDeleteIssueResponse(issueKey, false); // Pass false to skip confirmation
      }

      // Optionally, mark the original issues as duplicates in Jira
      const confirmMarkDuplicates = window.confirm('Would you like to mark the deleted issues as duplicates of the new issue in Jira?');
      if (confirmMarkDuplicates) {
        await markIssuesAsDuplicates(issuesToDelete, response.data.issueKey);
      }

      fetchIssuesData();
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
      fetchIssuesData();
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
        fetchIssuesData();
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
   * Deletes a Jira issue by calling the backend API.
   * @param issueKey - The key of the issue to delete.
   * @param confirmPrompt - Whether to show confirmation prompt (default true).
   */
  const handleDeleteIssueResponse = async (issueKey: string, confirmPrompt: boolean = true) => {
    const proceed = confirmPrompt ? window.confirm(`Are you sure you want to delete issue ${issueKey}?`) : true;
    if (!proceed) return;

    setActionInProgress(true);
    try {
      await axios.post('/api/delete-issue', { issueKey, config });
      toast({
        title: `Issue ${issueKey} deleted successfully.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchIssuesData();
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

  /**
   * Fetches issues data after processing is complete.
   */
  const fetchIssuesData = async () => {
    if (!config) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/issues', { config, action: 'fetch' });
      setIssues(response.data.issues || []);
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

  return (
    <Box p={4}>
      <Heading mb={4}>Jira Backlog Manager</Heading>

      {/* Jira Configuration Form */}
      {!config ? (
        <JiraConfigForm />
      ) : (
        <>
          <HStack spacing={4} justify="center">
            <Button
              colorScheme="teal"
              onClick={startProcessing}
              isLoading={processing}
              isDisabled={processing}
            >
              {processing ? 'Processing...' : 'Process Issues'}
            </Button>
            <Tooltip label={issues.length === 0 ? "Process issues before detection is possible" : ""}>
              <Button
                colorScheme="blue"
                onClick={detectDuplicates}
                isLoading={duplicateLoading}
                disabled={issues.length === 0}
              >
                Detect Duplicates
              </Button>
            </Tooltip>
          </HStack>

          {error && (
            <Alert status="error" mt={4}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          {processing && (
            <VStack spacing={4} mt={6}>
              <CircularProgress
                value={progressPercentage}
                color="teal.400"
                size="120px"
                thickness="8px"
              >
                <CircularProgressLabel>{`${Math.round(progressPercentage)}%`}</CircularProgressLabel>
              </CircularProgress>
              <Text>
                {progress.completed} / {progress.total} issues processed
              </Text>
              <Spinner />
            </VStack>
          )}

          {/* Duplicate Detection Results */}
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

          {/* All Issues List */}
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
                    {/* Display specific action details based on suggestion.action */}
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
                <Button
                  colorScheme="green"
                  onClick={() => handleAction('recommendation')}
                  isLoading={actionInProgress}
                >
                  Accept Recommendation
                </Button>
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
