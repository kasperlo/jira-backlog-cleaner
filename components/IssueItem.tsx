// components/IssueItem.tsx

import {
    ListItem,
    Text,
    HStack,
    Button,
    Box,
    useDisclosure,
} from '@chakra-ui/react';
import { JiraIssue } from '../types/types';
import { IssueModal } from './IssueModal';
import { useState } from 'react';
import { IssueTypeBadge } from './IssueTypeBadge';
import { issueTypeColorMap, issueTypeIconMap } from '@/utils/issueTypeMappings';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { statusColorMap, statusIconMap } from '@/utils/statusMappings';
import { priorityColorMap, priorityIconMap } from '@/utils/priorityMappings';

interface IssueItemProps {
    issue: JiraIssue;
    onDelete: (
        issueKey: string,
        confirmPrompt?: boolean,
        onSuccess?: () => void
    ) => Promise<void>;
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
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [explanation, setExplanation] = useState('');
    const [suggestedSummary, setSuggestedSummary] = useState('');
    const [isFetching, setIsFetching] = useState(false);

    const issueType = issue.fields.issuetype.name;
    const issueTypeColors = issueTypeColorMap[issue.fields.issuetype.name] || { bg: 'gray', color: 'white' };
    const issueTypeIcon = issueTypeIconMap[issue.fields.issuetype.name];

    const status = issue.fields.status?.name || 'Unknown';
    const statusColors = statusColorMap[status] || { bg: 'gray', color: 'white' };
    const statusIcon = statusIconMap[status];

    const priority = issue.fields.priority?.name || 'None';
    const priorityColors = priorityColorMap[priority] || { bg: 'gray', color: 'white' };
    const priorityIcon = priorityIconMap[priority];

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

    const handleDelete = async () => {
        await onDelete(issue.key, true, onClose);
    };

    return (
        <ListItem borderBottomWidth="1px">
            <HStack spacing={4} p={4} alignItems="start" wrap="wrap">
                <Box flex="1" minW="100px">
                    <IssueTypeBadge
                        issueType={issueType}
                        icon={issueTypeIcon}
                        bgColor={issueTypeColors.bg}
                        textColor={issueTypeColors.color}
                        size="lg" // Use size 'md' for IssueItem
                    />
                </Box>
                <Box flex="1" minW="100px">
                    <Text fontWeight="bold">{issue.key}</Text>
                </Box>
                <Box flex="1" minW="100px">
                    {issue.fields.priority && (
                        <PriorityBadge
                            priority={priority}
                            icon={priorityIcon}
                            color={priorityColors.color}
                            size="md"
                        />
                    )}
                </Box>
                <Box flex="3" minW="200px">
                    <Text>{issue.fields.summary}</Text>
                </Box>
                <Box flex="1" minW="100px">
                    <Text>{new Date(issue.fields.created).toLocaleDateString()}</Text>
                </Box>
                <Box flex="1" minW="100px">
                    <Button size="sm" onClick={onOpen}>
                        Details
                    </Button>
                </Box>
                <Box flex="1" minW="100px">
                    {issue.fields.status && (
                        <StatusBadge
                            status={status}
                            icon={statusIcon}
                            bgColor={statusColors.bg}
                            textColor={statusColors.color}
                            size="sm"
                        />
                    )}
                </Box>
            </HStack>

            <IssueModal
                isOpen={isOpen}
                onClose={onClose}
                issue={issue}
                onExplain={handleExplain}
                onSuggestSummary={handleSuggestSummary}
                onDelete={handleDelete}
                onEditSummary={(newSummary) => onEditSummary(issue.key, newSummary)}
                explanation={explanation}
                suggestedSummary={suggestedSummary}
                isFetching={isFetching}
            />
        </ListItem>
    );
}
