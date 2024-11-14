// components/IssueCard.tsx

import {
    Box,
    Text,
    HStack,
    VStack,
    Input,
    IconButton,
    Button,
    useToast,
    Heading,
} from '@chakra-ui/react';
import { CheckIcon, AddIcon } from '@chakra-ui/icons';
import React, { useState } from 'react';
import { JiraIssue, Subtask, SubtaskInput } from '../types/types';
import { IssueTypeBadge } from './IssueTypeBadge';
import { issueTypeColorMap, issueTypeIconMap } from '../utils/issueTypeMappings';
import { SubtaskInputRow } from './SubtaskInputRow';

interface IssueCardProps {
    issue: JiraIssue;
    isNew?: boolean; // Flag to identify if this is the new merged issue
    onSubtasksChange?: (subtasks: string[]) => void; // Callback to pass subtasks to parent
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue, isNew = false, onSubtasksChange }) => {
    const toast = useToast();
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    const issueTypeColors = issueTypeColorMap[issueType] || { bg: 'gray', color: 'white' };
    const issueTypeIcon = issueTypeIconMap[issueType];
    const subtasks: Subtask[] = issue.fields?.subtasks || [];

    // Subtask state (only for new merged issue)
    const [subtasksList, setSubtasksList] = useState<string[]>([]);
    const [subtaskInputs, setSubtaskInputs] = useState<SubtaskInput[]>([]);
    const [subtaskIdCounter, setSubtaskIdCounter] = useState(0);

    // Handlers for adding subtasks
    const handleAddSubtaskInput = () => {
        setSubtaskInputs([...subtaskInputs, { id: subtaskIdCounter, title: '', isConfirmed: false }]);
        setSubtaskIdCounter(subtaskIdCounter + 1);
    };

    const handleSubtaskTitleChange = (id: number, value: string) => {
        setSubtaskInputs(subtaskInputs.map(input => input.id === id ? { ...input, title: value } : input));
    };

    const handleConfirmSubtask = (id: number) => {
        const input = subtaskInputs.find(input => input.id === id);
        if (input && input.title.trim() !== '') {
            const updatedSubtasks = [...subtasksList, input.title.trim()];
            setSubtasksList(updatedSubtasks);
            setSubtaskInputs(subtaskInputs.filter(input => input.id !== id));
            if (onSubtasksChange) {
                onSubtasksChange(updatedSubtasks);
            }
        } else {
            toast({
                title: 'Invalid Subtask',
                description: 'Subtask title cannot be empty.',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
        }
    };

    return (
        <Box
            borderWidth="1px"
            borderRadius="md"
            p={4}
            width="500px"
            height="500px"
            m={2}
            overflow="hidden"
            display="flex"
            flexDirection="column"
            position="relative"
        >
            {/* Top Section: Issue Type and Key */}
            <Box>
                <HStack width="100%" justifyContent="space-between">
                    <HStack>
                        <IssueTypeBadge
                            issueType={issueType}
                            icon={issueTypeIcon}
                            bgColor={issueTypeColors.bg}
                            textColor={issueTypeColors.color}
                            size="sm"
                        />
                        <Text fontWeight="bold" fontSize="sm">
                            {issue.key}
                        </Text>
                    </HStack>
                    <Text fontSize="sm">
                        Created: {issue.fields?.created ? new Date(issue.fields.created).toLocaleDateString() : 'N/A'}
                    </Text>
                </HStack>
            </Box>

            {/* Middle Section: Summary and Description */}
            <Box flex="1" overflow="auto" mt={2}>
                <VStack align="start" spacing={2}>
                    <Text fontSize="lg" fontWeight="bold">
                        {issue.fields?.summary || 'No summary available'}
                    </Text>
                    {issue.fields?.description && (
                        <Text color="gray.600">
                            {issue.fields.description}
                        </Text>
                    )}
                </VStack>
            </Box>

            {/* Subtasks Section (only for new merged issue) */}
            {isNew && (
                <Box mt={4}>
                    <Heading size="sm" mb={2}>
                        Subtasks
                    </Heading>

                    {/* Existing Subtasks */}
                    <VStack align="start" spacing={2}>
                        {subtasksList.map((subtask, index) => (
                            <Box key={index} p={2} bg="gray.100" borderRadius="md" width="100%">
                                <Text>{subtask}</Text>
                            </Box>
                        ))}
                    </VStack>

                    {/* Subtask Inputs */}
                    <VStack align="start" spacing={2} mt={2}>
                        {subtaskInputs.map(input => (
                            <SubtaskInputRow
                                key={input.id}
                                id={input.id}
                                title={input.title}
                                onChange={handleSubtaskTitleChange}
                                onConfirm={handleConfirmSubtask}
                            />
                        ))}
                    </VStack>

                    {/* Add Subtask Button */}
                    <Button
                        leftIcon={<AddIcon />}
                        colorScheme="blue"
                        variant="outline"
                        mt={2}
                        onClick={handleAddSubtaskInput}
                        size="sm"
                    >
                        + Add Subtask(s)
                    </Button>
                </Box>
            )}

            {/* Bottom Section: Subtasks List (for existing issues) */}
            {!isNew && subtasks.length > 0 && (
                <Box mt={4} height="175px" overflow="auto">
                    <VStack align="start" spacing={1}>
                        {subtasks.map((subtask) => (
                            <Box
                                key={subtask.id}
                                p={2}
                                bg="gray.100"
                                borderRadius="md"
                                width="100%"
                                boxShadow="sm"
                            >
                                <HStack>
                                    <Text fontSize="sm" fontWeight="bold" width="85px">
                                        {subtask.key}:
                                    </Text>
                                    <Text fontSize="sm" width="350px">
                                        {subtask.fields.summary}
                                    </Text>
                                </HStack>
                            </Box>
                        ))}
                    </VStack>
                </Box>
            )}
        </Box>
    );
}
