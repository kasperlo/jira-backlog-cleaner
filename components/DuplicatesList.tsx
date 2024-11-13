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
import { DuplicateGroup } from '../types/types';
import { IssueCard } from './IssueCard';
import { useState } from 'react';
import { SimilarityBar } from './SimilarityBar';

interface DuplicatesListProps {
    duplicates: DuplicateGroup[];
    onMerge: (group: DuplicateGroup) => void;
    onNotDuplicate: (group: DuplicateGroup) => void;
    onIgnore: (group: DuplicateGroup) => void;
    onExplain: (issueKey: string) => Promise<string>;
    onSuggestSummary: (issueKey: string) => Promise<string>;
    onEditSummary: (issueKey: string, newSummary: string) => Promise<void>;
    actionInProgress: boolean;
}

export function DuplicatesList({
    duplicates,
    onMerge,
    onNotDuplicate,
    onIgnore,
    onExplain,
    onSuggestSummary,
    onEditSummary,
    actionInProgress,
}: DuplicatesListProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const totalPairs = duplicates.length;

    const currentGroup = duplicates[currentIndex];

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev < totalPairs - 1 ? prev + 1 : prev));
    };

    if (!currentGroup) {
        return <Text>No duplicate issues detected.</Text>;
    }

    const similarityScore = currentGroup.similarityScore;

    return (
        <Box mb={4}>
            <Heading size="md" mb={4}>
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
            <Flex justifyContent="space-between" alignItems="flex-start" wrap="wrap">
                {currentGroup.group.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                ))}
            </Flex>

            {/* Action Buttons */}
            <VStack spacing={4} mt={4}>
                <ButtonGroup>
                    <Button
                        colorScheme="teal"
                        onClick={() => onMerge(currentGroup)}
                        isLoading={actionInProgress}
                    >
                        Get Merge Suggestion
                    </Button>
                    <Button
                        colorScheme="blue"
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
                        Ignore
                    </Button>
                </ButtonGroup>
            </VStack>
        </Box>
    );
}
