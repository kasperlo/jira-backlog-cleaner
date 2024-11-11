// app/page.tsx

'use client';

import { Box, Heading, HStack, Button, Tooltip, Text, VStack } from '@chakra-ui/react';
import JiraConfigForm from '../components/JiraConfigForm';
import { useJira } from '../context/JiraContext';
import { useIssueProcessing } from '../hooks/useIssueProcessing';
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';
import { useActionHandlers } from '../hooks/useActionHandlers';
import { IssuesList } from '../components/IssuesList';
import { DuplicatesList } from '../components/DuplicatesList';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { DuplicateGroup, SuggestedIssue } from '../types/types';
import { useEffect, useState } from 'react';
import { IssueListSkeleton } from '@/components/IssueListSkeleton';
import SuggestIssuesForm from '../components/SuggestIssuesForm';
import SuggestedIssuesList from '../components/SuggestedIssuesList';

export default function HomePage() {
  const { config } = useJira();
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedIssue[]>([]);

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
    onExplain,
    onSuggestSummary,
    onEditSummary,
  } = useActionHandlers(fetchIssuesData, issues, setDuplicates);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or a loading indicator
  }

  return (
    <Box p={6}>
      <Heading mb={6}>Jira Backlog Manager</Heading>

      {!config ? (
        <JiraConfigForm />
      ) : (
        <>
          <SuggestIssuesForm onSuggestionsReceived={setSuggestions} />

          {suggestions.length > 0 && (
            <Box mb={6}>
              <SuggestedIssuesList suggestions={suggestions} setSuggestions={setSuggestions} />
            </Box>
          )}

          <VStack spacing={6} align="center" mb={6}>
            <Button
              colorScheme="teal"
              onClick={startProcessing}
              isLoading={processing}
              isDisabled={processing}
              width="60%"
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
                width="60%"
              >
                Detect Duplicates
              </Button>
            </Tooltip>
          </VStack>

          {duplicates.length > 0 && (
            <Box mb={6}>
              <DuplicatesList
                duplicates={duplicates}
                onMerge={(group: DuplicateGroup) => openConfirmationModal(group, 'merge')}
                onNotDuplicate={(group: DuplicateGroup) => openConfirmationModal(group, 'notDuplicate')}
                onIgnore={(group: DuplicateGroup) => openConfirmationModal(group, 'ignore')}
                onExplain={onExplain}
                onSuggestSummary={onSuggestSummary}
                onEditSummary={onEditSummary}
                actionInProgress={actionInProgress}
              />
            </Box>
          )}

          <Box>
            <Heading size="md" mt={6} mb={4}>
              All Issues
            </Heading>
            {processing ? (
              <IssueListSkeleton itemCount={10} />
            ) : issues.length === 0 ? (
              <Text>No issues found.</Text>
            ) : (
              <IssuesList
                issues={issues}
                onDelete={handleDeleteIssueResponse}
                onExplain={onExplain}
                onSuggestSummary={onSuggestSummary}
                onEditSummary={onEditSummary}
                actionInProgress={actionInProgress}
              />
            )}
          </Box>

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
