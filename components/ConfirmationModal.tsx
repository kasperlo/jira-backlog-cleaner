// components/ConfirmationModal.tsx

import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    ButtonGroup,
    Box,
    Text,
    List,
    ListItem,
} from '@chakra-ui/react';
import { DuplicateGroup, ActionSuggestion, ActionType } from '../types/types';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    actionType: ActionType | null;
    selectedGroup: DuplicateGroup | null;
    suggestion: ActionSuggestion | null;
    handleAction: (selectedOption?: 'recommendation' | 'markAsDuplicate') => void;
    actionInProgress: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    actionType,
    selectedGroup,
    suggestion,
    handleAction,
    actionInProgress,
}: ConfirmationModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Confirm Action</ModalHeader>
                <ModalBody>
                    {actionType === 'merge' && selectedGroup ? (
                        <Box>
                            <Text mb={4}>You have selected to merge the following issues:</Text>
                            <List spacing={2} mb={4}>
                                {selectedGroup.group.map((issue) => (
                                    <ListItem key={issue.id}>
                                        {issue.key}: {issue.fields.summary}
                                    </ListItem>
                                ))}
                            </List>
                            {suggestion ? (
                                <Box>
                                    <Text mb={2} fontWeight="bold">
                                        GPT-4 Recommendation (Action {suggestion.action}):
                                    </Text>
                                    <Text mb={4}>{suggestion.description}</Text>
                                    {/* Display specific action details based on suggestion.action */}
                                    <Text mt={4}>
                                        You can proceed with this recommendation or choose to mark the issues as duplicates in Jira to manually handle them later.
                                    </Text>
                                </Box>
                            ) : (
                                <Text>
                                    Unable to retrieve recommendation. You can proceed to handle the issues manually.
                                </Text>
                            )}
                            <Text mt={4} fontWeight="bold">
                                Do you wish to proceed?
                            </Text>
                        </Box>
                    ) : (actionType === 'notDuplicate' || actionType === 'ignore') && selectedGroup ? (
                        <Box>
                            <Text mb={4}>
                                You are about to{' '}
                                {actionType === 'notDuplicate'
                                    ? 'mark the following issues as not duplicates'
                                    : 'ignore the duplicate suggestion for the following issues'}
                                :
                            </Text>
                            <List spacing={2} mb={4}>
                                {selectedGroup.group.map((issue) => (
                                    <ListItem key={issue.id}>
                                        {issue.key}: {issue.fields.summary}
                                    </ListItem>
                                ))}
                            </List>
                            <Text>
                                This will remove the duplicate suggestion from the list. No changes will be made to
                                the issues in Jira.
                            </Text>
                            <Text mt={4} fontWeight="bold">
                                Do you wish to proceed?
                            </Text>
                        </Box>
                    ) : null}
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        mr={3}
                    >
                        Cancel
                    </Button>
                    {actionType === 'merge' && selectedGroup ? (
                        <ButtonGroup>
                            <Button
                                colorScheme="green"
                                onClick={() => handleAction('recommendation')}
                                isLoading={actionInProgress}
                            >
                                Accept Merge
                            </Button>
                            <Button
                                colorScheme="blue"
                                onClick={() => handleAction('markAsDuplicate')}
                                isLoading={actionInProgress}
                            >
                                Mark as Duplicates
                            </Button>
                        </ButtonGroup>
                    ) : actionType === 'merge' && !suggestion ? (
                        <Button
                            colorScheme="blue"
                            onClick={() => handleAction('markAsDuplicate')}
                            isLoading={actionInProgress}
                        >
                            Handle Manually
                        </Button>
                    ) : actionType === 'notDuplicate' || actionType === 'ignore' ? (
                        <Button
                            colorScheme="blue"
                            onClick={() => handleAction()}
                            isLoading={actionInProgress}
                        >
                            Confirm
                        </Button>
                    ) : null}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
