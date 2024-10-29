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
  VStack,
  HStack,
  useToast,
  Divider,
} from '@chakra-ui/react';
import axios from 'axios';

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: {
      name: string;
    };
    created: string;
    description?: string;
    parent?: {
      key: string;
    };
  };
}

interface DuplicateGroup {
  group: JiraIssue[];
  explanation: string;
}

interface ActionSuggestion {
  action: string;
  description: string;
  deleteIssueKeys: string[];
  keepIssueKeys: string[];
  modifyIssueKeys: string[];
}

interface Suggestion {
  summary: string;
  description: string;
  issuetype: string;
}

export default function HomePage() {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [duplicateLoading, setDuplicateLoading] = useState<boolean>(false);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [duplicateError, setDuplicateError] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [actionType, setActionType] = useState<'merge' | 'notDuplicate' | 'ignore' | null>(null);
  const [suggestion, setSuggestion] = useState<ActionSuggestion | null>(null);
  const [subtasks, setSubtasks] = useState<JiraIssue[] | null>(null);
  const [deleteAction, setDeleteAction] = useState<'delete' | 'convert' | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [projectDescription, setProjectDescription] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState<boolean>(false);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/issues');
      setIssues(response.data.issues);
      setDuplicates([]);
      toast({
        title: 'Issues fetched successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError('Failed to fetch Jira issues.');
      toast({
        title: 'Error fetching issues.',
        description: 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const detectDuplicates = async () => {
    setDuplicateLoading(true);
    setDuplicateError('');
    try {
      const response = await axios.post('/api/detect-duplicates', { issues });
      setDuplicates(response.data.duplicates);
      toast({
        title: 'Duplicate detection completed.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Error detecting duplicates:', err);
      setDuplicateError('Failed to detect duplicates: ' + err);
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

  const suggestNewIssues = async () => {
    setSuggesting(true);
    setError('');
    try {
      const response = await axios.post('/api/suggest-new-issues', {
        projectDescription,
      });
      setSuggestions(response.data.suggestions);
    } catch (err) {
      console.error('Error suggesting new issues:', err);
      setError('Failed to suggest new issues.');
    } finally {
      setSuggesting(false);
    }
  };

  const createIssueInJira = async (suggestion: Suggestion) => {
    try {
      const response = await axios.post('/api/create-issue', { suggestion });
      alert(`Issue ${response.data.issueKey} created successfully.`);
      fetchIssues();
    } catch (err) {
      console.error('Error creating issue:', err);
      alert('Failed to create issue.');
    }
  };

  const handleAction = async (selectedOption?: 'recommendation' | 'markAsDuplicate') => {
    if (!selectedGroup || !actionType) return;

    setActionInProgress(true);
    try {
      if (actionType === 'merge') {
        if (selectedOption === 'recommendation' && suggestion) {
          const actionNumber = suggestion.action.trim();

          if (actionNumber === '1') {
            await performDeleteAndUpdate();
          } else if (actionNumber === '2') {
            await performChangeIssueType();
          } else if (actionNumber === '3') {
            await performMakeSubtask();
          } else {
            alert('Recommendation not implemented. Proceeding to mark as duplicates.');
            await linkIssuesAsDuplicates(selectedGroup.group);
          }
        } else {
          await linkIssuesAsDuplicates(selectedGroup.group);
        }

        setDuplicates((prev) => prev.filter((group) => group !== selectedGroup));
      } else if (actionType === 'notDuplicate' || actionType === 'ignore') {
        setDuplicates((prev) => prev.filter((group) => group !== selectedGroup));
      }
    } catch (error) {
      console.error('Error performing action:', error);
      alert('An error occurred while performing the action.');
    } finally {
      setActionInProgress(false);
      setSelectedGroup(null);
      setActionType(null);
      setSuggestion(null);
      onClose();
    }
  };

  const openConfirmationModal = async (
    group: DuplicateGroup,
    type: 'merge' | 'notDuplicate' | 'ignore'
  ) => {
    setSelectedGroup(group);
    setActionType(type);

    if (type === 'merge') {
      try {
        const response = await axios.post('/api/suggest-action', {
          issues: group.group,
        });
        const data = response.data;
        // Ensure arrays are initialized
        data.suggestion.deleteIssueKeys = data.suggestion.deleteIssueKeys || [];
        data.suggestion.keepIssueKeys = data.suggestion.keepIssueKeys || [];
        data.suggestion.modifyIssueKeys = data.suggestion.modifyIssueKeys || [];
        setSuggestion(data.suggestion);
      } catch (error) {
        console.error('Error getting action suggestion:', error);
        setSuggestion(null);
        alert('An error occurred while getting the action suggestion.');
      }
    } else {
      setSuggestion(null);
    }

    onOpen();
  };

  const handleDeleteIssueResponse = async (issueKey: string) => {
    try {
      const deleteResponse = await axios.post('/api/delete-issue', { issueKey });
      const deleteData = deleteResponse.data;

      if (deleteResponse.status === 200) {
        // Issue deleted successfully
        alert(`Issue ${issueKey} deleted successfully.`);
      } else if (deleteData.subtasks) {
        // Issue has subtasks, prompt the user
        setSubtasks(deleteData.subtasks);
        // Open a modal to show subtasks and ask for user decision
        onOpen();
      } else {
        throw new Error(deleteData.error || `Failed to delete issue ${issueKey}.`);
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
      alert('An error occurred while deleting the issue.');
    }
  };

  const performDeleteAndUpdate = async () => {
    if (!suggestion) return;

    const issueKeysToDelete = suggestion.deleteIssueKeys;
    const issueKeysToModify = suggestion.modifyIssueKeys;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete issue(s) ${issueKeysToDelete.join(', ')}${issueKeysToModify.length > 0
        ? ` and possibly update issue(s) ${issueKeysToModify.join(', ')}`
        : ''
      }?`
    );
    if (!confirmDelete) return;

    for (const issueKey of issueKeysToDelete) {
      await handleDeleteIssueResponse(issueKey);
    }

    alert(
      `Issue(s) ${issueKeysToDelete.join(', ')} have been processed.${issueKeysToModify.length > 0
        ? ` Issue(s) ${issueKeysToModify.join(', ')} may need to be updated.`
        : ''
      }`
    );
  };

  const handleSubtaskAction = async (issueKey: string, action: 'delete' | 'convert') => {
    setActionInProgress(true);
    try {
      const response = await axios.post('/api/delete-issue', { issueKey, action });
      const data = response.data;
      if (response.status === 200) {
        alert(data.message);
      } else {
        throw new Error(data.error || 'Failed to perform the action.');
      }
    } catch (error) {
      console.error('Error handling subtask action:', error);
      alert('An error occurred while performing the action.');
    } finally {
      setActionInProgress(false);
      setSubtasks(null);
      setDeleteAction(null);
      onClose();
    }
  };

  const performChangeIssueType = async () => {
    if (!suggestion) return;

    const issueKeysToModify = suggestion.modifyIssueKeys;

    if (issueKeysToModify.length === 0) {
      alert('No issues specified to change type.');
      return;
    }

    const newIssueType = 'Task'; // Modify as needed or get from user input

    for (const issueKey of issueKeysToModify) {
      const updateResponse = await axios.post('/api/update-issue-type', {
        issueKey,
        newIssueType,
      });
      const updateData = updateResponse.data;
      if (updateResponse.status !== 200) {
        throw new Error(updateData.error || `Failed to update issue type for ${issueKey}.`);
      }
    }

    alert(`Issue(s) ${issueKeysToModify.join(', ')} have been changed to type ${newIssueType}.`);
  };

  const performMakeSubtask = async () => {
    if (!suggestion) return;

    const issueKeysToModify = suggestion.modifyIssueKeys;

    if (issueKeysToModify.length === 0) {
      alert('No issues specified to change.');
      return;
    }

    // Prepare the epic suggestion
    const epicSuggestion = {
      summary: 'Improve backlog management',
      description: 'This epic groups the following issues: ' + issueKeysToModify.join(', '),
      issuetype: 'Epic',
    };

    // Step 1: Create the new Epic
    try {
      const response = await axios.post('/api/create-issue', {
        suggestion: epicSuggestion,
        isEpic: true, // Specify that this is an Epic
      });

      const epicKey = response.data.issueKey;

      // Step 2: Link issues to the Epic
      for (const issueKey of issueKeysToModify) {
        try {
          await axios.post('/api/link-issue-to-epic', {
            issueKey,
            epicKey,
          });
        } catch (error) {
          console.error(error);
          alert(`An error occurred while linking issue ${issueKey} to Epic.`);
          return;
        }
      }

      alert(`Issues ${issueKeysToModify.join(', ')} have been linked to Epic ${epicKey}.`);
    } catch (error) {
      alert('Failed to create Epic.');
    }
  };


  const linkIssuesAsDuplicates = async (issuesToLink: JiraIssue[]) => {
    const issueKeys = issuesToLink.map((issue) => issue.key);
    const response = await axios.post('/api/link-issues', { issueKeys });
    const data = response.data;
    if (response.status === 200) {
      alert(`Issues ${issueKeys.join(', ')} have been linked as duplicates.`);
    } else {
      throw new Error(data.error || 'Failed to link issues.');
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  return (
    <Box p={4}>
      <Heading mb={4}>Jira Backlog Manager</Heading>

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
        <Button onClick={suggestNewIssues} isLoading={suggesting}>
          Suggest New Issues
        </Button>
      </Box>

      {suggestions.length > 0 && (
        <Box mb={6}>
          <Heading size="md">Suggested New Issues</Heading>
          <List spacing={3} mt={2}>
            {suggestions.map((suggestion, index) => (
              <ListItem key={index} borderWidth="1px" borderRadius="md" p={4}>
                <Text fontWeight="bold">{suggestion.summary}</Text>
                <Text>{suggestion.description}</Text>
                <Text fontSize="sm" color="gray.500">
                  Type: {suggestion.issuetype}
                </Text>
                <Button
                  mt={2}
                  colorScheme="green"
                  onClick={() => createIssueInJira(suggestion)}
                >
                  Create Issue
                </Button>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <HStack spacing={4} justify="center">
        <Button colorScheme="teal" onClick={fetchIssues} isLoading={loading || detecting}>
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
          <Heading size="md">Potential Duplicates</Heading>
          {duplicates.map((dupGroup, index) => (
            <Box key={index} borderWidth="1px" borderRadius="md" p={4} mb={2}>
              <Text fontWeight="bold">Group {index + 1}</Text>
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

      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Action</ModalHeader>
          <ModalBody>
            {subtasks && subtasks.length > 0 ? (
              // Modal content for subtasks handling
              <Box>
                <Text mb={4}>
                  The issue has the following subtasks. Do you wish to delete them as well or
                  convert them into separate tasks?
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
                    {/* Display detailed information based on GPT-4's explicit issue keys */}
                    {suggestion.deleteIssueKeys.length > 0 && (
                      <Text>
                        Issue(s) to be <strong>deleted</strong>: {suggestion.deleteIssueKeys.join(', ')}
                      </Text>
                    )}
                    {suggestion.keepIssueKeys.length > 0 && (
                      <Text>
                        Issue(s) to be <strong>kept</strong>: {suggestion.keepIssueKeys.join(', ')}
                      </Text>
                    )}
                    {suggestion.modifyIssueKeys.length > 0 && (
                      <Text>
                        Issue(s) to be <strong>modified</strong>: {suggestion.modifyIssueKeys.join(', ')}
                      </Text>
                    )}
                    <Text mt={4}>
                      You can proceed with this recommendation or choose to just mark the issues as duplicates.
                    </Text>
                  </Box>
                ) : (
                  <Text>
                    Unable to retrieve recommendation. You can proceed to mark the issues as duplicates.
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
            {subtasks && subtasks.length > 0 ? null : actionType === 'merge' && suggestion ? (
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
                  Mark as Duplicates
                </Button>
              </ButtonGroup>
            ) : actionType === 'merge' && !suggestion ? (
              <Button
                colorScheme="blue"
                onClick={() => handleAction('markAsDuplicate')}
                isLoading={actionInProgress}
              >
                Mark as Duplicates
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
