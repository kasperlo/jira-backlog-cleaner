import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
    VStack,
    Text,
    Input,
    IconButton,
    Button,
    HStack,
    useDisclosure,
    Spinner,
} from '@chakra-ui/react';
import { useState } from 'react';
import { CheckIcon, EditIcon } from '@chakra-ui/icons';
import { JiraIssue } from '../types/types';

interface IssueModalProps {
    isOpen: boolean;
    onClose: () => void;
    issue: JiraIssue;
    onExplain: () => Promise<void>;
    onSuggestSummary: () => Promise<void>;
    onDelete: () => Promise<void>;
    onEditSummary: (newSummary: string) => Promise<void>;
    explanation: string;
    suggestedSummary: string;
    isFetching: boolean;
}

export function IssueModal({
    issue,
    onExplain,
    onSuggestSummary,
    onDelete,
    onEditSummary,
    explanation,
    suggestedSummary,
    isFetching,
}: IssueModalProps) {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [isEditing, setIsEditing] = useState(false);
    const [newSummary, setNewSummary] = useState(issue.fields.summary);

    const handleSaveSummary = () => {
        if (newSummary.trim()) {
            onEditSummary(newSummary);
            setIsEditing(false);
        }
    };

    return (
        <>
            <Button onClick={onOpen}>Expand Issue</Button>
            <Modal isOpen={isOpen} onClose={onClose} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Issue Details</ModalHeader>
                    <ModalCloseButton />

                    <ModalBody>
                        <VStack align="start" spacing={4}>
                            {/* Editable Summary */}
                            <HStack>
                                {isEditing ? (
                                    <>
                                        <Input
                                            value={newSummary}
                                            onChange={(e) => setNewSummary(e.target.value)}
                                            autoFocus
                                        />
                                        <IconButton
                                            icon={<CheckIcon />}
                                            aria-label="Save Summary"
                                            onClick={handleSaveSummary}
                                            colorScheme="teal"
                                        />
                                    </>
                                ) : (
                                    <HStack>
                                        <Text fontWeight="bold" fontSize="lg">
                                            {issue.key}: {issue.fields.summary}
                                        </Text>
                                        <IconButton
                                            icon={<EditIcon />}
                                            aria-label="Edit Summary"
                                            onClick={() => setIsEditing(true)}
                                            size="sm"
                                            variant="ghost"
                                        />
                                    </HStack>
                                )}
                            </HStack>

                            {/* Other Issue Details */}
                            <Text>Description: {issue.fields.description || 'No description available'}</Text>
                            <Text>Issue Type: {issue.fields.issuetype.name}</Text>
                            <Text>Created: {new Date(issue.fields.created).toLocaleDateString()}</Text>
                            {issue.fields.parent && <Text>Parent Issue: {issue.fields.parent.key}</Text>}
                            {issue.fields.subtasks && issue.fields.subtasks.length > 0 && (
                                <VStack align="start" spacing={1}>
                                    <Text>Subtasks:</Text>
                                    {issue.fields.subtasks.map((subtask) => (
                                        <Text key={subtask.id}>
                                            - {subtask.key}: {subtask.fields.summary}
                                        </Text>
                                    ))}
                                </VStack>
                            )}

                            {/* Explanation or Suggested Summary Display */}
                            {isFetching ? (
                                <Spinner />
                            ) : (
                                <>
                                    {explanation && (
                                        <VStack align="start" mt={4}>
                                            <Text fontWeight="bold">Explanation:</Text>
                                            <Text>{explanation}</Text>
                                        </VStack>
                                    )}
                                    {suggestedSummary && (
                                        <VStack align="start" mt={4}>
                                            <Text fontWeight="bold">Suggested Summary:</Text>
                                            <Text fontStyle="italic">{suggestedSummary}</Text>
                                        </VStack>
                                    )}
                                </>
                            )}
                        </VStack>
                    </ModalBody>

                    {/* Action Buttons */}
                    <ModalFooter>
                        <Button
                            colorScheme="teal"
                            onClick={onExplain}
                            isLoading={isFetching && !explanation}
                            mr={2}
                        >
                            Explain Issue
                        </Button>
                        <Button
                            colorScheme="purple"
                            onClick={onSuggestSummary}
                            isLoading={isFetching && !suggestedSummary}
                            mr={2}
                        >
                            Suggest New Summary
                        </Button>
                        <Button colorScheme="red" onClick={onDelete}>
                            Delete Issue
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
