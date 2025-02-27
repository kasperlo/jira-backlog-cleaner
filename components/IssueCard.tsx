// components/IssueCard.tsx

import {
    Box,
    Text,
    HStack,
    VStack,
    IconButton,
    Button,
    ButtonGroup,
    Tooltip,
    Accordion,
    AccordionItem,
    AccordionButton,
    AccordionPanel,
    AccordionIcon,
    Stack,
    Flex,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import React, { useState } from 'react';
import { JiraIssue, Subtask } from '../types/types';
import { IssueTypeBadge } from './IssueTypeBadge';
import { issueTypeColorMap, issueTypeIconMap } from '../utils/issueTypeMappings';
import { TbSubtask } from 'react-icons/tb';
import { statusColorMap, statusIconMap } from '@/utils/statusMappings';
import { StatusBadge } from './StatusBadge';
import { HiOutlineDuplicate } from 'react-icons/hi';

interface IssueCardProps {
    issue: JiraIssue;
    isNew?: boolean;
    onSubtasksChange?: (subtasks: string[]) => void;
    onAcceptSuggestion?: () => void;
    onIgnoreSuggestion?: () => void;
    onDelete?: (issueKey: string) => void;
    onMakeSubtask?: (subtaskIssueKey: string, parentIssueKey: string) => void;
    onMarkAsDuplicate?: (sourceIssueKey: string, targetIssueKey: string) => void;
    duplicateIssueKey?: string;
    linkTypes?: string[]; // New prop for link types
    isActionInProgress?: boolean;
}

export const IssueCard: React.FC<IssueCardProps> = ({
    issue,
    isNew = false,
    onAcceptSuggestion,
    onIgnoreSuggestion,
    onDelete,
    onMakeSubtask,
    duplicateIssueKey,
    linkTypes = [], // Default to empty array
    isActionInProgress = false,
    onMarkAsDuplicate,
}) => {
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    const issueTypeColors = issueTypeColorMap[issueType] || { bg: 'gray', color: 'white' };
    const IssueTypeIcon = issueTypeIconMap[issueType];
    const subtasks: Subtask[] = issue.fields?.subtasks || [];

    const status = issue.fields.status?.name || 'Unknown';
    const statusColors = statusColorMap[status] || { bg: 'gray', color: 'white' };
    const statusIcon = statusIconMap[status];

    // Subtask state
    const [subtasksList] = useState<Subtask[]>(subtasks);

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
            position="relative" // To position the link text
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
                {issue.fields.status && (
                    <StatusBadge
                        status={status}
                        icon={statusIcon}
                        bgColor={statusColors.bg}
                        textColor={statusColors.color}
                        size="sm"
                    />
                )}
                <Text fontSize="sm">
                    Created: {issue.fields?.created ? new Date(issue.fields.created).toLocaleDateString() : 'N/A'}
                </Text>
            </HStack>

            {/* Issue Summary */}
            <Stack
                direction={{ base: 'column', md: 'row' }}
                display={{ base: 'none', md: 'flex' }}
                width={{ base: 'full', md: 'auto' }}
                alignItems="center"
                minHeight="120px"
                mt={{ base: 4, md: 2 }}
                p={{ base: 4, md: 2 }}
                bg={'gray.50'}
                borderRadius="20px"
            >
                <Text fontSize="lg" fontWeight="bold">
                    {issue.fields?.summary || 'No summary available'}
                </Text>
            </Stack>

            {/* Accordions for Description and Subtasks */}
            <Box mt={4} flex="1" overflowY="auto">
                <Accordion allowToggle>
                    {/* Description Accordion */}
                    <AccordionItem>
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
                    </AccordionItem>

                    {/* Subtasks Accordion */}
                    <AccordionItem>
                        <>
                            <AccordionButton>
                                <Box flex="1" textAlign="left">
                                    Subtasks
                                </Box>
                                <HStack spacing={2}>
                                    <AccordionIcon />
                                </HStack>
                            </AccordionButton>
                            <AccordionPanel pb={4}>
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
                    </AccordionItem>
                </Accordion>
            </Box>

            {/* Conditionally Render Accept/Ignore Buttons for Merge Suggestion */}
            {isNew && onAcceptSuggestion && onIgnoreSuggestion && (
                <ButtonGroup spacing={4} mt={4}>
                    <Button
                        colorScheme="green"
                        onClick={onAcceptSuggestion}
                        isLoading={isActionInProgress}
                        isDisabled={isActionInProgress}
                    >
                        Accept Suggestion
                    </Button>
                    <Button
                        colorScheme="red"
                        onClick={onIgnoreSuggestion}
                        isLoading={isActionInProgress}
                        isDisabled={isActionInProgress}
                    >
                        Ignore Suggestion
                    </Button>
                </ButtonGroup>
            )}

            {/* Action Buttons */}
            {!isNew && (
                <Box mt={4}>
                    <Flex justify="space-between" align="center">
                        {/* Existing Link Types Display */}
                        {duplicateIssueKey && linkTypes.length > 0 ?
                            <VStack align="start" spacing={1}>
                                <Text fontSize="xs" fontWeight="bold" color="gray.600">
                                    Existing link in Jira
                                </Text>
                                {linkTypes.map((linkType, index) => (
                                    <Text key={index} fontSize="xs" color="gray.600">
                                        {`${issue.key} ${linkType.toLowerCase()} ${duplicateIssueKey}`}
                                    </Text>
                                ))}
                            </VStack>
                            :
                            <VStack align="start" spacing={1}>
                                {linkTypes.map((linkType, index) => (
                                    <Text key={index} fontSize="xs" color="gray.600">
                                        {`${issue.key} ${linkType} ${duplicateIssueKey}`}
                                    </Text>
                                ))}
                            </VStack>
                        }

                        {/* Action Buttons */}
                        <HStack spacing={2}>
                            {onDelete && (
                                <Tooltip label="Delete issue">
                                    <IconButton
                                        icon={<DeleteIcon />}
                                        aria-label="Delete issue"
                                        size="sm"
                                        colorScheme="red"
                                        onClick={() => onDelete(issue.key)}
                                        isLoading={isActionInProgress}
                                        isDisabled={isActionInProgress}
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
                                        isLoading={isActionInProgress}
                                        isDisabled={isActionInProgress}
                                    />
                                </Tooltip>
                            )}

                            {duplicateIssueKey && onMarkAsDuplicate && (
                                <Tooltip label={`Mark ${issue.key} as duplicate of ${duplicateIssueKey} in Jira`}>
                                    <IconButton
                                        icon={<HiOutlineDuplicate />}
                                        aria-label="Mark as duplicate"
                                        size="sm"
                                        colorScheme="green"
                                        onClick={() => onMarkAsDuplicate(issue.key, duplicateIssueKey)}
                                        isLoading={isActionInProgress}
                                        isDisabled={isActionInProgress}
                                    />
                                </Tooltip>
                            )}
                        </HStack>
                    </Flex>
                </Box>
            )}
        </Box>
    );
};
