// components/DuplicatesList.tsx

import { Box, Heading, Text, ButtonGroup, Button } from '@chakra-ui/react';
import { DuplicateGroup, JiraIssue } from '../types/types';
import { IssueList } from './IssueList';

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
    return (
        <Box mb={4}>
            <Heading size="md">Potential Duplicate Pairs</Heading>
            {duplicates.map((dupGroup, index) => (
                <Box key={index} borderWidth="1px" borderRadius="md" p={4} mb={2}>
                    <Text fontWeight="bold">Pair {index + 1}</Text>
                    <Text fontStyle="italic" mb={2}>
                        {dupGroup.explanation}
                    </Text>
                    <IssueList issues={dupGroup.group} />
                    <ButtonGroup mt={4}>
                        <Button
                            colorScheme="blue"
                            onClick={() => onMerge(dupGroup)}
                            isLoading={actionInProgress}
                        >
                            Merge Issues
                        </Button>
                        <Button onClick={() => onNotDuplicate(dupGroup)}>Not Duplicates</Button>
                        <Button variant="ghost" onClick={() => onIgnore(dupGroup)}>
                            Ignore
                        </Button>
                    </ButtonGroup>
                </Box>
            ))}
        </Box>
    );
}
