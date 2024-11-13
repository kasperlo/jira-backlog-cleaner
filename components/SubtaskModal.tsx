import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    VStack,
    HStack,
    Text,
} from '@chakra-ui/react';
import { Subtask, SubtaskAction } from '../types/types';
import { useState } from 'react';

interface SubtaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtasks: Subtask[];
    handleSubtaskAction: (subtaskActions: SubtaskAction[]) => void;
    actionInProgress: boolean;
}

export function SubtaskModal({
    isOpen,
    onClose,
    subtasks,
    handleSubtaskAction,
    actionInProgress,
}: SubtaskModalProps) {
    const [subtaskActions, setSubtaskActions] = useState<SubtaskAction[]>(
        subtasks.map((subtask) => ({
            subtaskKey: subtask.key,
            action: 'delete', // Default action
        }))
    );

    const toggleAction = (subtaskKey: string) => {
        setSubtaskActions((prev) =>
            prev.map((sa) =>
                sa.subtaskKey === subtaskKey
                    ? { ...sa, action: sa.action === 'delete' ? 'convert' : 'delete' }
                    : sa
            )
        );
    };

    const handleAllAction = (action: 'delete' | 'convert') => {
        setSubtaskActions((prev) => prev.map((sa) => ({ ...sa, action })));
    };

    const handleSubmit = () => {
        handleSubtaskAction(subtaskActions);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Handle Subtasks</ModalHeader>
                <ModalBody>
                    <VStack align="start" spacing={3}>
                        <Text>The issue has subtasks. Choose an action for each:</Text>
                        {subtasks.map((subtask, index) => (
                            <HStack key={subtask.key} spacing={4}>
                                <Text>
                                    {subtask.key}: {subtask.summary}
                                </Text>
                                <Button size="sm" onClick={() => toggleAction(subtask.key)}>
                                    {subtaskActions[index].action === 'delete' ? 'Delete' : 'Convert to Task'}
                                </Button>
                            </HStack>
                        ))}
                        <HStack spacing={4} mt={4}>
                            <Button onClick={() => handleAllAction('delete')}>Delete All</Button>
                            <Button onClick={() => handleAllAction('convert')}>Convert All to Tasks</Button>
                        </HStack>
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" onClick={onClose} mr={3}>
                        Cancel
                    </Button>
                    <Button colorScheme="blue" onClick={handleSubmit} isLoading={actionInProgress}>
                        Proceed
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
