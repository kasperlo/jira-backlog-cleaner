// app/page.tsx

'use client';

import { Box, Heading, HStack, Button, Tooltip, Text } from '@chakra-ui/react';
import JiraConfigForm from '../components/JiraConfigForm';
import { useJira } from '../context/JiraContext';
import { useIssueProcessing } from '../hooks/useIssueProcessing';
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';
import { useActionHandlers } from '../hooks/useActionHandlers';
import { IssuesList } from '../components/IssuesList';
import { DuplicatesList } from '../components/DuplicatesList';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DuplicateGroup } from '../types/types';
import { useEffect, useState } from 'react';
import { IssueListSkeleton } from '@/components/IssueListSkeleton';

export default function HomePage() {
  const { config } = useJira();
  const [mounted, setMounted] = useState(false);

  const {
    issues,
    processing,
    progress,
    progressPercentage,
    error,
    startProcessing,
    fetchIssuesData,
  } = useIssueProcessing();

  const {
    duplicates,
    duplicateLoading,
    detectDuplicates,
    setDuplicates,
  } = useDuplicateDetection(issues);

  const {
    actionInProgress,
    selectedGroup,
    actionType,
    suggestion,
    subtasks,
    isOpen,
    onClose,
    openConfirmationModal,
    handleAction,
    handleSubtaskAction,
    handleDeleteIssueResponse,
  } = useActionHandlers(fetchIssuesData, issues, setDuplicates);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or a loading indicator
  }

  return (
    <Box p={4}>
      <Heading mb={4}>Jira Backlog Manager</Heading>

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
            <Tooltip
              label={
                issues.length === 0
                  ? 'Process issues before detecting duplicates'
                  : 'Start detection'
              }
            >
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

          {duplicates.length > 0 && (
            <DuplicatesList
              duplicates={duplicates}
              onMerge={(group: DuplicateGroup) => openConfirmationModal(group, 'merge')}
              onNotDuplicate={(group: DuplicateGroup) => openConfirmationModal(group, 'notDuplicate')}
              onIgnore={(group: DuplicateGroup) => openConfirmationModal(group, 'ignore')}
              actionInProgress={actionInProgress}
            />
          )}

          <Heading size="md" mt={6}>
            All Issues
          </Heading>
          {processing ? (
            // Render the skeleton list when processing
            <IssueListSkeleton itemCount={10} /> // Adjust itemCount as needed
          ) : issues.length === 0 ? (
            <Text>No issues found.</Text>
          ) : (
            <IssuesList
              issues={issues}
              onDelete={handleDeleteIssueResponse}
              actionInProgress={actionInProgress}
            />
          )}

          <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            actionType={actionType}
            selectedGroup={selectedGroup}
            suggestion={suggestion}
            handleAction={handleAction}
            actionInProgress={actionInProgress}
            subtasks={subtasks}
            handleSubtaskAction={handleSubtaskAction}
            setSubtasks={(value) => {
              // If you need to set subtasks from the modal
            }}
          />
        </>
      )}
    </Box>
  );
}
