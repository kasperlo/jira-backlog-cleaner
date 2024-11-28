// components/DuplicatesList.tsx

import {
    Box,
    Heading,
    Text,
    ButtonGroup,
    Button,
    Flex,
    VStack,
    useToast,
} from '@chakra-ui/react';
import { DuplicateGroup, JiraIssue } from '../types/types';
import { IssueCard } from './IssueCard';
import { useState } from 'react';
import { SimilarityBar } from './SimilarityBar';
import axios from 'axios';
import { useJira } from '@/context/JiraContext';
import { IssueCardSkeleton } from './IssueCardSkeleton';
import { IssueListSkeleton } from './IssueListSkeleton';

interface DuplicatesListProps {
    duplicates: DuplicateGroup[];
    setDuplicates: React.Dispatch<React.SetStateAction<DuplicateGroup[]>>;
    onMerge: (group: DuplicateGroup) => void;
    onNotDuplicate: (group: DuplicateGroup) => void;
    onIgnore: (group: DuplicateGroup) => void;
    actionInProgress: boolean;
}

export function DuplicatesList({
    duplicates,
    setDuplicates,
    onNotDuplicate,
    onIgnore,
    actionInProgress,
}: DuplicatesListProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadingActionSuggestion, setLoadingActionSuggestion] = useState(false);
    const [actionSuggestion, setActionSuggestion] = useState<string | null>(null);
    const [loadingMergeSuggestion, setLoadingMergeSuggestion] = useState(false);
    const [mergeSuggestion, setMergeSuggestion] = useState<JiraIssue | null>(null);

    const totalPairs = duplicates.length;
    const currentGroup = duplicates[currentIndex];

    const toast = useToast();

    const { config } = useJira();

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        setActionSuggestion(null);
        setMergeSuggestion(null);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev < totalPairs - 1 ? prev + 1 : prev));
        setActionSuggestion(null);
        setMergeSuggestion(null);
    };

    const handleGetSuggestion = async () => {
        setLoadingActionSuggestion(true);
        setActionSuggestion(null);
        try {
            const response = await axios.post('/api/suggest-action', {
                issues: currentGroup.group,
                config,
            });
            const suggestion = response.data.suggestion;
            setActionSuggestion(suggestion.description);
            toast({
                title: 'Action Suggestion Received',
                description: 'An action suggestion has been generated.',
                status: 'info',
                duration: 3000,
                isClosable: true,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error fetching action suggestion:', errorMessage);
            setActionSuggestion('Failed to fetch suggestion.');
            toast({
                title: 'Error',
                description: 'Failed to fetch action suggestion.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoadingActionSuggestion(false);
        }
    };

    const handleMergeSuggestion = async () => {
        setLoadingMergeSuggestion(true);
        setMergeSuggestion(null);
        try {
            const response = await axios.post('/api/merge-suggestion', {
                issues: currentGroup.group,
                config,
            });
            const suggestion = response.data.suggestion;
            setMergeSuggestion(suggestion);
            toast({
                title: 'Merge Suggestion Received',
                description: 'A merge suggestion has been generated.',
                status: 'info',
                duration: 3000,
                isClosable: true,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error fetching merge suggestion:', errorMessage);
            setMergeSuggestion(null);
            toast({
                title: 'Error',
                description: 'Failed to fetch merge suggestion.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoadingMergeSuggestion(false);
        }
    };

    const handleAcceptSuggestion = async () => {
        try {
            // Make DELETE calls for original issues with the 'delete' action
            const deleteResponses = await Promise.allSettled(
                currentGroup.group.map(issue =>
                    axios.post('/api/delete-issue', {
                        issueKey: issue.key,
                        config,
                        action: 'delete' // Specify the action here
                    })
                )
            );

            // Check for any failed deletions
            const failedDeletions = deleteResponses.filter(response => response.status === 'rejected');

            if (failedDeletions.length > 0) {
                throw new Error('One or more issues could not be deleted. Please check your permissions and try again.');
            }

            toast({
                title: 'Merge Accepted',
                description: 'Original issues deleted and new merged issue created successfully.',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });

            // Reset and move to the next duplicate pair
            setMergeSuggestion(null);
            goToNext();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error accepting merge suggestion:', error);
            toast({
                title: 'Error',
                description: errorMessage,
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }

    };

    const handleIgnoreSuggestion = () => {
        setMergeSuggestion(null);
        toast({
            title: 'Suggestion Ignored',
            description: 'The merge suggestion has been ignored.',
            status: 'info',
            duration: 3000,
            isClosable: true,
        });
        goToNext();
    };

    const handleDeleteIssue = async (issueKey: string) => {
        try {
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

            const confirmDelete = window.confirm(
                `Are you sure you want to delete issue ${issueKey} and all its subtasks?`
            );
            if (!confirmDelete) return;

            const response = await axios.post('/api/delete-issue', {
                issueKey,
                config,
                action: 'delete',
            });

            console.log('Delete issue response:', response);

            if (response.status === 200) {
                // Remove the duplicate pair from duplicates list
                setDuplicates((prev) => prev.filter((group) => group !== currentGroup));
                toast({
                    title: `Issue ${issueKey} and its subtasks deleted successfully.`,
                    status: 'success',
                    duration: 3000,
                    isClosable: true,
                });
                // Move to next duplicate pair
                goToNext();
            } else {
                console.error('Unexpected response status:', response.status);
                throw new Error(response.data.error || 'Failed to delete issue.');
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error deleting issue:', error);
            toast({
                title: 'Failed to delete issue.',
                description: errorMessage,
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
    };

    const handleMakeSubtask = async (subtaskIssueKey: string, parentIssueKey: string) => {
        try {
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

            const confirmAction = window.confirm(
                `Are you sure you want to make issue ${subtaskIssueKey} a subtask of ${parentIssueKey}? This will delete the original issue.`
            );
            if (!confirmAction) return;

            // Call the API to make subtask and delete the original issue
            await axios.post('/api/make-subtask', {
                subtaskIssueKey,
                parentIssueKey,
                config,
            });

            // Remove the duplicate pair from duplicates list
            setDuplicates((prev) => prev.filter((group) => group !== currentGroup));

            toast({
                title: `Issue ${subtaskIssueKey} has been converted into a subtask of ${parentIssueKey} and the original issue was deleted.`,
                status: 'success',
                duration: 3000,
                isClosable: true,
            });

            // Move to next duplicate pair
            goToNext();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error converting to subtask:', error);
            toast({
                title: 'Failed to convert issue to subtask.',
                description: errorMessage,
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
    };

    if (!currentGroup) {
        return <Text>No duplicate issues detected.</Text>;
    }

    const similarityScore = currentGroup.similarityScore;

    return (
        <Box mb={4} maxWidth="1100px" mx="auto">
            <Heading size="md" mb={4} textAlign="center">
                Potential Duplicate Pairs ({currentIndex + 1} of {totalPairs})
            </Heading>

            {/* Pagination Controls */}
            <Flex justifyContent="space-between" alignItems="center" mb={4}>
                <Button onClick={goToPrevious} isDisabled={currentIndex === 0}>
                    Previous
                </Button>
                <Text>
                    Pair {currentIndex + 1} of {totalPairs}
                </Text>
                <Button onClick={goToNext} isDisabled={currentIndex === totalPairs - 1}>
                    Next
                </Button>
            </Flex>

            {/* Similarity Bar */}
            <SimilarityBar similarityScore={similarityScore} />

            {/* Issue Cards */}
            <Flex justifyContent="center" alignItems="flex-start" wrap="wrap" mt={4}>
                {currentGroup.group.map((issue, index) => {
                    const otherIssues = currentGroup.group.filter((_, i) => i !== index);
                    const duplicateIssueKey = otherIssues[0]?.key || '';
                    return (
                        <IssueCard
                            key={issue.id}
                            issue={issue}
                            onDelete={handleDeleteIssue}
                            onMakeSubtask={handleMakeSubtask}
                            duplicateIssueKey={duplicateIssueKey}
                        />
                    );
                })}

                {/* Conditionally render IssueCardSkeleton or Merged Issue Card with Accept/Ignore Buttons */}
                {loadingMergeSuggestion ? (
                    <IssueCardSkeleton />
                ) : mergeSuggestion ? (
                    <IssueCard
                        issue={mergeSuggestion}
                        isNew={true}
                        onAcceptSuggestion={handleAcceptSuggestion}
                        onIgnoreSuggestion={handleIgnoreSuggestion}
                    />
                ) : null}
            </Flex>

            {/* Action Buttons */}
            <VStack spacing={4} mt={4}>
                <ButtonGroup>
                    <Button
                        colorScheme="blue"
                        onClick={handleGetSuggestion}
                        isLoading={actionInProgress || loadingActionSuggestion}
                    >
                        Get Action Suggestion
                    </Button>
                    <Button
                        colorScheme="teal"
                        onClick={handleMergeSuggestion}
                        isLoading={actionInProgress || loadingMergeSuggestion}
                    >
                        Merge Issues
                    </Button>
                    <Button
                        colorScheme="gray"
                        onClick={() => onNotDuplicate(currentGroup)}
                        isLoading={actionInProgress}
                    >
                        Mark as Duplicates in Jira
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => onIgnore(currentGroup)}
                        isLoading={actionInProgress}
                    >
                        Ignore Duplicate Pair
                    </Button>
                </ButtonGroup>

                {/* Suggestions Display */}
                <Flex
                    direction={['column', 'row']}
                    justifyContent="space-between"
                    width="100%"
                    mt={4}
                    gap={4}
                >
                    {/* Action Suggestion */}
                    <Box flex="1">
                        <Heading size="sm" mb={2}>
                            Action Suggestion
                        </Heading>
                        {loadingActionSuggestion ? (
                            <IssueListSkeleton itemCount={1} />
                        ) : actionSuggestion ? (
                            <Box
                                borderWidth="1px"
                                borderRadius="md"
                                p={4}
                                bg="gray.50"
                            >
                                <Text fontWeight="bold">Suggested Action:</Text>
                                <Text mt={2}>{actionSuggestion}</Text>
                            </Box>
                        ) : null}
                    </Box>
                </Flex>
            </VStack>
        </Box>
    );
}