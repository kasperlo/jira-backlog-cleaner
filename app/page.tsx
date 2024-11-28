// app/page.tsx

'use client';

import { Box, Heading, Button, Tooltip, Text, VStack, Flex, ButtonGroup, useToast } from '@chakra-ui/react';
import JiraConfigForm from '../components/JiraConfigForm';
import { useJira } from '../context/JiraContext';
import { useIssueProcessing } from '../hooks/useIssueProcessing';
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';
import { useActionHandlers } from '../hooks/useActionHandlers';
import { IssuesList } from '../components/IssuesList';
import { DuplicatesList } from '../components/DuplicatesList';
import { DuplicateGroup, SuggestedIssue } from '../types/types';
import { useEffect, useState } from 'react';
import { IssueListSkeleton } from '@/components/IssueListSkeleton';
import Header from '@/components/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProjectDescriptionPanel from '@/components/ProjectDescriptionPanel';
import NewFeaturesPanel from '@/components/NewFeaturesPanel';

export default function HomePage() {
  const { config } = useJira();
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedIssue[]>([]);
  const [selectedTab, setSelectedTab] = useState('list');

  const toast = useToast()

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
    onExplain,
    onSuggestSummary,
    onEditSummary,
  } = useActionHandlers(fetchIssuesData, issues, setIssues, setDuplicates);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (config && !processing && issues.length === 0) {
      startProcessing();
      setSelectedTab('list');
    }
  }, [config]);

  useEffect(() => {
    if (!processing && issues.length > 0 && duplicates.length === 0 && !duplicateLoading) {
      detectDuplicates();
    }
  }, [processing]);

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
            {issues.length === 0 ? 'Fetch Issues' : 'Update Issues List'}
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
              {DuplicatesList.length === 0 ? "Find Duplicates in Backlog" : "Find Duplicates Again"}
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Flex>

      {!config ? (
        <JiraConfigForm />
      ) : (
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <Box width="100%" mb={4}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">Issues</TabsTrigger>
              <TabsTrigger value="duplicates">Handle Duplicate Issues</TabsTrigger>
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
                onDelete={() => Promise.resolve()}
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
                  setDuplicates={setDuplicates}
                  onNotDuplicate={(group: DuplicateGroup) => {
                    // Immediately remove the group without confirmation
                    setDuplicates((prev) => prev.filter((g) => g !== group));
                    toast({
                      title: 'Marked as not duplicate.',
                      status: 'success',
                      duration: 3000,
                      isClosable: true,
                    });
                  }}
                  onIgnore={(group: DuplicateGroup) => {
                    // Immediately ignore the group without confirmation
                    setDuplicates((prev) => prev.filter((g) => g !== group));
                    toast({
                      title: 'Issue ignored successfully.',
                      status: 'info',
                      duration: 3000,
                      isClosable: true,
                    });
                  }}
                  actionInProgress={actionInProgress}
                />


              ) : (
                <Text>No duplicate issues detected.</Text>
              )}
            </VStack>
          </TabsContent>

          <TabsContent value="suggestions">
            <Flex>
              <Box width="50%" pr={2}>
                {/* Left-hand side */}
                <ProjectDescriptionPanel suggestions={suggestions} setSuggestions={setSuggestions} />
              </Box>
              <Box width="50%" pl={2}>
                {/* Right-hand side */}
                <NewFeaturesPanel />
              </Box>
            </Flex>
          </TabsContent>
        </Tabs>
      )}
    </Box>
  );
}
