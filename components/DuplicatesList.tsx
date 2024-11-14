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
import { SubtaskInput } from '../types/types';
import { SubtaskInputRow } from './SubtaskInputRow'; // Ensure this import exists

interface DuplicatesListProps {
    duplicates: DuplicateGroup[];
    onMerge: (group: DuplicateGroup) => void;
    onNotDuplicate: (group: DuplicateGroup) => void;
    onIgnore: (group: DuplicateGroup) => void;
    actionInProgress: boolean;
}

export function DuplicatesList({
    duplicates,
    onMerge,
    onNotDuplicate,
    onIgnore,
    actionInProgress,
}: DuplicatesListProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadingActionSuggestion, setLoadingActionSuggestion] = useState(false);
    const [actionSuggestion, setActionSuggestion] = useState<string | null>(null);
    const [loadingMergeSuggestion, setLoadingMergeSuggestion] = useState(false);
    const [mergeSuggestion, setMergeSuggestion] = useState<JiraIssue | null>(null);

    const [subtasksForNewIssue, setSubtasksForNewIssue] = useState<string[]>([]);

    const totalPairs = duplicates.length;
    const currentGroup = duplicates[currentIndex];

    const toast = useToast();

    const { config } = useJira();

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
        setActionSuggestion(null);
        setMergeSuggestion(null);
        setSubtasksForNewIssue([]);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev < totalPairs - 1 ? prev + 1 : prev));
        setActionSuggestion(null);
        setMergeSuggestion(null);
        setSubtasksForNewIssue([]);
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
        } catch (error: any) {
            console.error('Error fetching action suggestion:', error);
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
            console.log('Merge Suggestion Received:', suggestion);
            setMergeSuggestion(suggestion);
            toast({
                title: 'Merge Suggestion Received',
                description: 'A merge suggestion has been generated.',
                status: 'info',
                duration: 3000,
                isClosable: true,
            });
        } catch (error: any) {
            console.error('Error fetching merge suggestion:', error);
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

            // Prepare the suggestion payload with the correct structure
            const suggestionPayload = {
                summary: mergeSuggestion?.fields.summary,
                description: mergeSuggestion?.fields.description || "",
                issuetype: mergeSuggestion?.fields.issuetype.name, // Extract the name as a string
            };

            // Make CREATE call for the new merged issue with subtasks
            const createResponse = await axios.post('/api/create-issue', {
                suggestion: suggestionPayload, // Use the correctly structured suggestion
                isEpic: false,
                config,
                subtasks: subtasksForNewIssue, // Include subtasks here
            });

            toast({
                title: 'Merge Accepted',
                description: 'Original issues deleted and new merged issue created successfully.',
                status: 'success',
                duration: 5000,
                isClosable: true,
            });

            // Reset and move to the next duplicate pair
            setMergeSuggestion(null);
            setSubtasksForNewIssue([]);
            goToNext();
        } catch (error: any) {
            console.error('Error accepting merge suggestion:', error);
            toast({
                title: 'Error',
                description: error.response?.data?.error || error.message || 'Failed to accept merge suggestion.',
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
    };

    // Callback to collect subtasks from IssueCard
    const handleSubtasksChange = (subtasks: string[]) => {
        setSubtasksForNewIssue(subtasks);
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
                {currentGroup.group.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                ))}

                {/* New Merged Issue Card */}
                {mergeSuggestion && (
                    <IssueCard
                        issue={mergeSuggestion}
                        isNew={true}
                        onSubtasksChange={handleSubtasksChange}
                    />
                )}
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

                    {/* Conditionally Render Accept and Ignore Buttons When Merge Suggestion is Present */}
                    {mergeSuggestion && (
                        <ButtonGroup>
                            <Button
                                colorScheme="green"
                                onClick={handleAcceptSuggestion}
                                isLoading={actionInProgress}
                            >
                                Accept Suggestion
                            </Button>
                            <Button
                                colorScheme="red"
                                onClick={handleIgnoreSuggestion}
                                isLoading={actionInProgress}
                            >
                                Ignore Suggestion
                            </Button>
                        </ButtonGroup>
                    )}
                </Flex>
            </VStack>
        </Box>
    );
}