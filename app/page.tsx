// app/page.tsx

'use client';

import { Box, Heading, Button, Tooltip, Text, VStack, Flex, ButtonGroup } from '@chakra-ui/react';
import JiraConfigForm from '../components/JiraConfigForm';
import { useJira } from '../context/JiraContext';
import { useIssueProcessing } from '../hooks/useIssueProcessing';
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';
import { useActionHandlers } from '../hooks/useActionHandlers';
import { IssuesList } from '../components/IssuesList';
import { DuplicatesList } from '../components/DuplicatesList';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SubtaskModal } from '../components/SubtaskModal';
import { DuplicateGroup, SuggestedIssue } from '../types/types';
import { useEffect, useState } from 'react';
import { IssueListSkeleton } from '@/components/IssueListSkeleton';
import SuggestIssuesForm from '../components/SuggestIssuesForm';
import SuggestedIssuesList from '../components/SuggestedIssuesList';
import Header from '@/components/Header';

// Import the custom tabs from shadcn/ui
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function HomePage() {
  const { config } = useJira();
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedIssue[]>([]);

  const {
    issues,
    setIssues,
    processing,
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
    isConfirmationOpen,
    onConfirmationClose,
    isSubtaskModalOpen,
    onSubtaskModalClose,
    openConfirmationModal,
    handleAction,
    handleSubtaskAction,
    handleDeleteIssueResponse,
    onExplain,
    onSuggestSummary,
    onEditSummary,
    setSubtasks,
  } = useActionHandlers(fetchIssuesData, issues, setIssues, setDuplicates);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or a loading indicator
  }

  return (
    <Box p={6}>
      <Flex alignItems="center" justifyContent="space-between" mb={6}>
        <Header />
        <ButtonGroup spacing={4}>
          <Button
            colorScheme="teal"
            onClick={startProcessing}
            isLoading={processing}
            isDisabled={processing}
            rounded="2xl"
            size="lg"
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
              rounded="2xl"
              size="lg"
            >
              Detect Duplicates
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Flex>

      {!config ? (
        <JiraConfigForm />
      ) : (
        <Tabs>
          <Box width="100%" mb={4}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">List Issues</TabsTrigger>
              <TabsTrigger value="duplicates">Detect Duplicate Issues</TabsTrigger>
              <TabsTrigger value="suggestions">Get Suggestions for New Issues</TabsTrigger>
            </TabsList>
          </Box>

          <TabsContent value="list">
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
          </TabsContent>

          <TabsContent value="duplicates">
            <VStack spacing={6} align="center" mb={6}>
              {duplicates.length > 0 ? (
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
              ) : (
                <Text>No duplicate issues detected.</Text>
              )}
            </VStack>
          </TabsContent>

          <TabsContent value="suggestions">
            <SuggestIssuesForm onSuggestionsReceived={setSuggestions} />
            {suggestions.length > 0 && (
              <Box mb={6}>
                <SuggestedIssuesList suggestions={suggestions} setSuggestions={setSuggestions} />
              </Box>
            )}
          </TabsContent>
        </Tabs>
      )}

      {subtasks && subtasks.length > 0 && (
        <SubtaskModal
          isOpen={isSubtaskModalOpen}
          onClose={() => {
            setSubtasks(null);
            onSubtaskModalClose();
          }}
          subtasks={subtasks}
          handleSubtaskAction={handleSubtaskAction}
          actionInProgress={actionInProgress}
        />
      )}

      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={onConfirmationClose}
        actionType={actionType}
        selectedGroup={selectedGroup}
        suggestion={suggestion}
        handleAction={handleAction}
        actionInProgress={actionInProgress}
      />
    </Box>
  );
}
