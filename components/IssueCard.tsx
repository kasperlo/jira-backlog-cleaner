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
    ButtonGroup,
    Tooltip,
    Spinner,
    Accordion,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    AccordionIcon,
} from '@chakra-ui/react';
import { CheckIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';
import React, { useState } from 'react';
import { JiraIssue, Subtask } from '../types/types';
import { IssueTypeBadge } from './IssueTypeBadge';
import { issueTypeColorMap, issueTypeIconMap } from '../utils/issueTypeMappings';
import { TbSubtask } from 'react-icons/tb';
import axios from 'axios';
import { useJira } from '@/context/JiraContext';

interface IssueCardProps {
    issue: JiraIssue;
    isNew?: boolean; // Flag to identify if this is the new merged issue
    onSubtasksChange?: (subtasks: string[]) => void; // Callback to pass subtasks to parent
    onAcceptSuggestion?: () => void; // Optional prop for handling accept
    onIgnoreSuggestion?: () => void; // Optional prop for handling ignore
    onDelete?: (issueKey: string) => void; // Optional prop for deleting an issue
    onMakeSubtask?: (subtaskIssueKey: string, parentIssueKey: string) => void; // Optional prop for making subtask
    duplicateIssueKey?: string; // Key of the duplicate issue to make this a subtask
}

export const IssueCard: React.FC<IssueCardProps> = ({
    issue,
    isNew = false,
    onSubtasksChange,
    onAcceptSuggestion,
    onIgnoreSuggestion,
    onDelete,
    onMakeSubtask,
    duplicateIssueKey,
}) => {
    const toast = useToast();
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    const issueTypeColors = issueTypeColorMap[issueType] || { bg: 'gray', color: 'white' };
    const IssueTypeIcon = issueTypeIconMap[issueType];
    const subtasks: Subtask[] = issue.fields?.subtasks || [];

    const { config } = useJira();

    // Subtask state
    const [subtasksList, setSubtasksList] = useState<Subtask[]>(subtasks);
    const [subtaskInputValue, setSubtaskInputValue] = useState('');
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);
    const [isAddingSubtask, setIsAddingSubtask] = useState(false); // Loading state for adding subtask

    // Handler for adding a new subtask
    const handleAddSubtask = async () => {
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

        if (subtaskInputValue.trim() === '') {
            toast({
                title: 'Invalid Subtask',
                description: 'Subtask title cannot be empty.',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setIsAddingSubtask(true); // Start loading

        try {
            // Call API to create subtask
            const response = await axios.post('/api/create-subtask', {
                parentIssueKey: issue.key,
                summary: subtaskInputValue.trim(),
                config,
            });

            const newSubtask = response.data.subtask as Subtask;
            setSubtasksList([newSubtask, ...subtasksList]);
            setSubtaskInputValue('');
            setShowSubtaskInput(false);
        } catch (error: any) {
            console.error('Error adding subtask:', error);
            toast({
                title: 'Failed to add subtask.',
                description: error.response?.data?.error || 'Please try again later.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsAddingSubtask(false); // End loading
        }
    };

    // Handler for showing the subtask input field
    const handleShowSubtaskInput = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowSubtaskInput(!showSubtaskInput);
    };

    return (
        <Box
            borderWidth="1px"
            borderRadius="md"
            p={4}
            width="500px"
            m={2}
            overflow="hidden"
            display="flex"
            flexDirection="column"
        >
            {/* Top Section: Issue Type and Key */}
            <HStack justifyContent="space-between">
                <HStack>
                    <IssueTypeBadge
                        issueType={issueType}
                        icon={IssueTypeIcon}
                        bgColor={issueTypeColors.bg}
                        textColor={issueTypeColors.color}
                        size="sm"
                    />
                    <Text fontWeight="bold" fontSize="sm">
                        {issue.key}
                    </Text>
                </HStack>
                <Text fontSize="sm">
                    Created:{' '}
                    {issue.fields?.created ? new Date(issue.fields.created).toLocaleDateString() : 'N/A'}
                </Text>
            </HStack>

            {/* Issue Summary */}
            <Box mt={2}>
                <Text fontSize="lg" fontWeight="bold">
                    {issue.fields?.summary || 'No summary available'}
                </Text>
            </Box>

            {/* Accordions for Description and Subtasks */}
            <Box mt={4} flex="1" overflowY="auto">
                <Accordion allowToggle>

                    {/* Description Accordion */}
                    <AccordionItem>
                        {({ isExpanded }) => (
                            <>
                                <AccordionButton>
                                    <Box flex="1" textAlign="left">
                                        Description
                                    </Box>
                                    <AccordionIcon />
                                </AccordionButton>
                                <AccordionPanel pb={4}>
                                    {issue.fields?.description ? (
                                        <Text>{issue.fields.description}</Text>
                                    ) : (
                                        <Text color="gray.500">No description available.</Text>
                                    )}
                                </AccordionPanel>
                            </>
                        )}
                    </AccordionItem>

                    {/* Subtasks Accordion */}
                    <AccordionItem>
                        {({ isExpanded }) => (
                            <>
                                <AccordionButton>
                                    <Box flex="1" textAlign="left">
                                        Subtasks
                                    </Box>
                                    <HStack spacing={2}>
                                        <IconButton
                                            icon={<AddIcon />}
                                            aria-label="Add subtask"
                                            size="sm"
                                            colorScheme="blue"
                                            onClick={handleShowSubtaskInput}
                                            onFocus={(e) => e.stopPropagation()}
                                            onClickCapture={(e) => e.stopPropagation()}
                                        />
                                        <AccordionIcon />
                                    </HStack>
                                </AccordionButton>
                                <AccordionPanel pb={4}>
                                    {showSubtaskInput && (
                                        <HStack mt={2}>
                                            <Input
                                                placeholder="New subtask title"
                                                value={subtaskInputValue}
                                                onChange={(e) => setSubtaskInputValue(e.target.value)}
                                                size="sm"
                                                isDisabled={isAddingSubtask}
                                            />
                                            <IconButton
                                                icon={isAddingSubtask ? <Spinner size="sm" /> : <CheckIcon />}
                                                aria-label="Confirm add subtask"
                                                size="sm"
                                                colorScheme="green"
                                                onClick={handleAddSubtask}
                                                isLoading={isAddingSubtask}
                                                isDisabled={isAddingSubtask}
                                            />
                                        </HStack>
                                    )}
                                    <VStack align="start" spacing={1} mt={2}>
                                        {subtasksList.length > 0 ? (
                                            subtasksList.map((subtask) => (
                                                <Box
                                                    key={subtask.id}
                                                    p={2}
                                                    bg="gray.100"
                                                    borderRadius="md"
                                                    width="100%"
                                                    boxShadow="sm"
                                                >
                                                    <HStack justifyContent="space-between">
                                                        <HStack>
                                                            <Text fontSize="sm" fontWeight="bold">
                                                                {subtask.key}:
                                                            </Text>
                                                            <Text fontSize="sm">{subtask.fields?.summary || 'No summary'}</Text>
                                                        </HStack>
                                                    </HStack>
                                                </Box>
                                            ))
                                        ) : (
                                            <Text color="gray.500">No subtasks available.</Text>
                                        )}
                                    </VStack>
                                </AccordionPanel>
                            </>
                        )}
                    </AccordionItem>

                </Accordion>
            </Box>

            {/* Conditionally Render Accept/Ignore Buttons for Merge Suggestion */}
            {isNew && onAcceptSuggestion && onIgnoreSuggestion && (
                <ButtonGroup spacing={4} mt={4}>
                    <Button colorScheme="green" onClick={onAcceptSuggestion}>
                        Accept Suggestion
                    </Button>
                    <Button colorScheme="red" onClick={onIgnoreSuggestion}>
                        Ignore Suggestion
                    </Button>
                </ButtonGroup>
            )}

            {/* Action Buttons */}
            {!isNew && (
                <Box mt={4} alignSelf="flex-end">
                    <HStack spacing={2}>
                        {onDelete && (
                            <Tooltip label="Delete issue">
                                <IconButton
                                    icon={<DeleteIcon />}
                                    aria-label="Delete issue"
                                    size="sm"
                                    colorScheme="red"
                                    onClick={() => onDelete(issue.key)}
                                />
                            </Tooltip>
                        )}
                        {duplicateIssueKey && onMakeSubtask && (
                            <Tooltip label={`Make subtask of ${duplicateIssueKey}`}>
                                <IconButton
                                    icon={<TbSubtask />}
                                    aria-label="Make subtask"
                                    size="sm"
                                    colorScheme="blue"
                                    onClick={() => onMakeSubtask(issue.key, duplicateIssueKey)}
                                />
                            </Tooltip>
                        )}
                    </HStack>
                </Box>
            )}
        </Box>
    );
};
