// components/DuplicatesList.tsx

import {
    Box,
    Heading,
    Text,
    ButtonGroup,
    Button,
    Flex,
    VStack,
} from '@chakra-ui/react';
import { DuplicateGroup, JiraIssue } from '../types/types';
import { IssueCard } from './IssueCard';
import { useState } from 'react';
import { SimilarityBar } from './SimilarityBar';
import axios from 'axios';
import { IssueListSkeleton } from './IssueListSkeleton';
import { useJira } from '@/context/JiraContext';
import { IssueCardSkeleton } from './IssueCardSkeleton';

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
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);
    const [actionSuggestion, setActionSuggestion] = useState<string | null>(null);
    const [mergeSuggestion, setMergeSuggestion] = useState<JiraIssue | null>(null);

    const totalPairs = duplicates.length;
    const currentGroup = duplicates[currentIndex];

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
        setLoadingSuggestion(true);
        setActionSuggestion(null);
        try {
            const response = await axios.post('/api/suggest-action', {
                issues: currentGroup.group,
                config,
            });
            const suggestion = response.data.suggestion;
            setActionSuggestion(suggestion.description);
        } catch (error) {
            console.error('Error fetching action suggestion:', error);
            setActionSuggestion('Failed to fetch suggestion.');
        } finally {
            setLoadingSuggestion(false);
        }
    };

    const handleMergeSuggestion = async () => {
        setLoadingSuggestion(true);
        setMergeSuggestion(null);
        try {
            const response = await axios.post('/api/merge-suggestion', {
                issues: currentGroup.group,
                config,
            });
            const suggestion = response.data.suggestion;
            console.log('Merge Suggestion Received:', suggestion);
            setMergeSuggestion(suggestion);
        } catch (error) {
            console.error('Error fetching merge suggestion:', error);
            setMergeSuggestion(null);
        } finally {
            setLoadingSuggestion(false);
        }
    };

    const handleAcceptSuggestion = async () => {
        try {
            // Make DELETE calls for original issues
            await Promise.all(
                currentGroup.group.map(issue =>
                    axios.post('/api/delete-issue', { issueKey: issue.key, config })
                )
            );

            // Make CREATE call for the new merged issue
            await axios.post('/api/create-issue', {
                suggestion: mergeSuggestion,
                isEpic: false,
                config,
            });

            // Reset and move to the next duplicate pair
            setMergeSuggestion(null);
            goToNext();
        } catch (error) {
            console.error('Error accepting merge suggestion:', error);
        }
    };

    const handleIgnoreSuggestion = () => {
        setMergeSuggestion(null);
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
            </Flex>

            {/* Action Buttons */}
            <VStack spacing={4} mt={4}>
                <ButtonGroup>
                    <Button
                        colorScheme="blue"
                        onClick={handleGetSuggestion}
                        isLoading={actionInProgress || loadingSuggestion}
                    >
                        Get Action Suggestion
                    </Button>
                    <Button
                        colorScheme="teal"
                        onClick={handleMergeSuggestion}
                        isLoading={actionInProgress || loadingSuggestion}
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

                {/* Suggestion Display */}
                <Box width="100%" mt={4}>
                    {loadingSuggestion ? (
                        <Flex direction="column" align="center" width="100%">
                            <IssueCardSkeleton />
                        </Flex>
                    ) : mergeSuggestion ? (
                        <Flex direction="column" align="center" width="100%">
                            <IssueCard issue={mergeSuggestion} />
                            <ButtonGroup mt={2}>
                                <Button colorScheme="green" onClick={handleAcceptSuggestion}>
                                    Accept New Issue
                                </Button>
                                <Button colorScheme="gray" onClick={handleIgnoreSuggestion}>
                                    Ignore Suggestion
                                </Button>
                                <Button colorScheme="blue" onClick={handleMergeSuggestion}>
                                    Try Again
                                </Button>
                            </ButtonGroup>
                        </Flex>
                    ) : actionSuggestion && (
                        <Box
                            borderWidth="1px"
                            borderRadius="md"
                            p={4}
                            width="100%"
                            bg="gray.50"
                        >
                            <Text fontWeight="bold">Suggested Action:</Text>
                            <Text mt={2}>{actionSuggestion}</Text>
                        </Box>
                    )}
                </Box>
            </VStack >
        </Box >
    );
}
