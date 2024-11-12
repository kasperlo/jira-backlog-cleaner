// components/IssueItem.tsx

import {
    ListItem,
    Text,
    VStack,
    HStack,
    useDisclosure,
} from '@chakra-ui/react';
import { JiraIssue } from '../types/types';
import { IssueModal } from './IssueModal';
import { useState } from 'react';

interface IssueItemProps {
    issue: JiraIssue;
    onDelete: (issueKey: string) => Promise<void>;
    onExplain: (issueKey: string) => Promise<string>;
    onSuggestSummary: (issueKey: string) => Promise<string>;
    onEditSummary: (issueKey: string, newSummary: string) => Promise<void>;
    actionInProgress?: boolean;
}

export function IssueItem({
    issue,
    onDelete,
    onExplain,
    onSuggestSummary,
    onEditSummary,
}: IssueItemProps) {
    const { isOpen, onClose } = useDisclosure();
    const [explanation, setExplanation] = useState('');
    const [suggestedSummary, setSuggestedSummary] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    const handleExplain = async () => {
        setIsFetching(true);
        const result = await onExplain(issue.key);
        setExplanation(result);
        setIsFetching(false);
    };

    const handleSuggestSummary = async () => {
        setIsFetching(true);
        const result = await onSuggestSummary(issue.key);
        setSuggestedSummary(result);
        setIsFetching(false);
    };

    return (
        <ListItem borderWidth="1px" borderRadius="md" p={4}>
            <HStack justify="space-between" align="start">
                <VStack align="start" spacing={2}>
                    <Text fontWeight="bold">
                        {issue.key}: {issue.fields.summary}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                        Type: {issue.fields.issuetype.name} | Created:{' '}
                        {new Date(issue.fields.created).toLocaleDateString()}
                    </Text>
                </VStack>
            </HStack>

            <IssueModal
                isOpen={isOpen}
                onClose={onClose}
                issue={issue}
                onExplain={handleExplain}
                onSuggestSummary={handleSuggestSummary}
                onDelete={() => onDelete(issue.key)}
                onEditSummary={(newSummary) => onEditSummary(issue.key, newSummary)}
                explanation={explanation}
                suggestedSummary={suggestedSummary}
                isFetching={isFetching}
            />
        </ListItem>
    );
}
