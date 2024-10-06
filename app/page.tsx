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
  useDisclosure,
} from '@chakra-ui/react';

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
    // Add other fields as needed
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

export default function HomePage() {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [actionType, setActionType] = useState<'merge' | 'notDuplicate' | 'ignore' | null>(null);
  const [suggestion, setSuggestion] = useState<ActionSuggestion | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/issues');
      const data = await response.json();
      if (response.ok) {
        setIssues(data.issues);
      } else {
        setError(data.error || 'Failed to fetch issues.');
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError('An error occurred while fetching issues.');
    } finally {
      setLoading(false);
    }
  };

  const detectDuplicates = async () => {
    setDetecting(true);
    setError('');
    try {
      const response = await fetch('/api/detect-duplicates');
      const data = await response.json();
      if (response.ok) {
        setDuplicates(data.duplicates);
      } else {
        setError(data.error || 'Failed to detect duplicates.');
      }
    } catch (err) {
      console.error('Error detecting duplicates:', err);
      setError('An error occurred while detecting duplicates.');
    } finally {
      setDetecting(false);
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
        const response = await fetch('/api/suggest-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issues: group.group }),
        });
        const data = await response.json();
        if (response.ok) {
          // Ensure arrays are initialized
          data.suggestion.deleteIssueKeys = data.suggestion.deleteIssueKeys || [];
          data.suggestion.keepIssueKeys = data.suggestion.keepIssueKeys || [];
          data.suggestion.modifyIssueKeys = data.suggestion.modifyIssueKeys || [];
          setSuggestion(data.suggestion);
        } else {
          setSuggestion(null);
          alert(`Error: ${data.error}`);
        }
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

  const performDeleteAndUpdate = async () => {
    if (!suggestion) return;

    const issueKeysToDelete = suggestion.deleteIssueKeys;
    const issueKeysToModify = suggestion.modifyIssueKeys;

    // Confirm with the user
    const confirmDelete = window.confirm(
      `Are you sure you want to delete issue(s) ${issueKeysToDelete.join(', ')}${issueKeysToModify.length > 0
        ? ` and possibly update issue(s) ${issueKeysToModify.join(', ')}`
        : ''
      }?`
    );
    if (!confirmDelete) return;

    // Delete issues
    for (const issueKey of issueKeysToDelete) {
      const deleteResponse = await fetch('/api/delete-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey }),
      });
      const deleteData = await deleteResponse.json();
      if (!deleteResponse.ok) {
        throw new Error(deleteData.error || `Failed to delete issue ${issueKey}.`);
      }
    }

    // Optionally update issues
    // Implement logic to update issues if necessary

    alert(
      `Issue(s) ${issueKeysToDelete.join(', ')} have been deleted.${issueKeysToModify.length > 0
        ? ` Issue(s) ${issueKeysToModify.join(', ')} may need to be updated.`
        : ''
      }`
    );
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
      const updateResponse = await fetch('/api/update-issue-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey, newIssueType }),
      });
      const updateData = await updateResponse.json();
      if (!updateResponse.ok) {
        throw new Error(updateData.error || `Failed to update issue type for ${issueKey}.`);
      }
    }

    alert(
      `Issue(s) ${issueKeysToModify.join(', ')} have been changed to type ${newIssueType}.`
    );
  };

  const performMakeSubtask = async () => {
    if (!suggestion) return;

    const parentIssueKey = suggestion.keepIssueKeys[0];
    const subtaskIssueKeys = suggestion.modifyIssueKeys;

    if (!parentIssueKey || subtaskIssueKeys.length === 0) {
      alert('No parent or subtask issues specified.');
      return;
    }

    for (const subtaskIssueKey of subtaskIssueKeys) {
      const makeSubtaskResponse = await fetch('/api/make-subtask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentIssueKey,
          subtaskIssueKey,
        }),
      });
      const makeSubtaskData = await makeSubtaskResponse.json();
      if (!makeSubtaskResponse.ok) {
        throw new Error(
          makeSubtaskData.error || `Failed to make ${subtaskIssueKey} a subtask of ${parentIssueKey}.`
        );
      }
    }

    alert(
      `Issue(s) ${subtaskIssueKeys.join(', ')} are now subtasks of issue ${parentIssueKey}.`
    );
  };

  const linkIssuesAsDuplicates = async (issuesToLink: JiraIssue[]) => {
    const issueKeys = issuesToLink.map((issue) => issue.key);
    const response = await fetch('/api/link-issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueKeys }),
    });
    const data = await response.json();
    if (response.ok) {
      alert(`Issues ${issueKeys.join(', ')} have been linked as duplicates.`);
    } else {
      throw new Error(data.error || 'Failed to link issues.');
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  if (loading) {
    return (
      <Box p={4} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Loading issues...</Text>
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Heading mb={4}>Jira Issues</Heading>
      <Button mb={4} onClick={fetchIssues} isDisabled={loading || detecting}>
        Refresh Issues
      </Button>
      <Button
        mb={4}
        ml={2}
        onClick={detectDuplicates}
        isLoading={detecting}
        isDisabled={loading}
      >
        Detect Duplicates
      </Button>
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
                <Button
                  variant="ghost"
                  onClick={() => openConfirmationModal(dupGroup, 'ignore')}
                >
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
            {actionType === 'merge' && selectedGroup && (
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
                        Issue(s) to be <strong>deleted</strong>:{' '}
                        {suggestion.deleteIssueKeys.join(', ')}
                      </Text>
                    )}
                    {suggestion.keepIssueKeys.length > 0 && (
                      <Text>
                        Issue(s) to be <strong>kept</strong>:{' '}
                        {suggestion.keepIssueKeys.join(', ')}
                      </Text>
                    )}
                    {suggestion.modifyIssueKeys.length > 0 && (
                      <Text>
                        Issue(s) to be <strong>modified</strong>:{' '}
                        {suggestion.modifyIssueKeys.join(', ')}
                      </Text>
                    )}
                    <Text mt={4}>
                      You can proceed with this recommendation or choose to just mark
                      the issues as duplicates.
                    </Text>
                  </Box>
                ) : (
                  <Text>
                    Unable to retrieve recommendation. You can proceed to mark the
                    issues as duplicates.
                  </Text>
                )}
                <Text mt={4} fontWeight="bold">
                  Do you wish to proceed?
                </Text>
              </Box>
            )}
            {(actionType === 'notDuplicate' || actionType === 'ignore') && selectedGroup && (
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
                  This will remove the duplicate suggestion from the list. No changes will
                  be made to the issues in Jira.
                </Text>
                <Text mt={4} fontWeight="bold">
                  Do you wish to proceed?
                </Text>
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose} mr={3}>
              Cancel
            </Button>
            {actionType === 'merge' && suggestion && (
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
            )}
            {actionType === 'merge' && !suggestion && (
              <Button
                colorScheme="blue"
                onClick={() => handleAction('markAsDuplicate')}
                isLoading={actionInProgress}
              >
                Mark as Duplicates
              </Button>
            )}
            {(actionType === 'notDuplicate' || actionType === 'ignore') && (
              <Button
                colorScheme="blue"
                onClick={() => handleAction()}
                isLoading={actionInProgress}
              >
                Confirm
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
