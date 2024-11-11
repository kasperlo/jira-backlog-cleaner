// components/SuggestedIssuesList.tsx

import React, { useState } from 'react';
import {
    Box,
    Heading,
    Text,
    Button,
    VStack,
    List,
    ListItem,
    HStack,
    useToast,
    Spinner,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    ModalFooter,
} from '@chakra-ui/react';
import { SuggestedIssue, SimilarIssue } from '../types/types';
import { useJira } from '../context/JiraContext';

interface SuggestedIssuesListProps {
    suggestions: SuggestedIssue[];
    setSuggestions: React.Dispatch<React.SetStateAction<SuggestedIssue[]>>;
}

const SuggestedIssuesList: React.FC<SuggestedIssuesListProps> = ({ suggestions, setSuggestions }) => {
    const { config } = useJira();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [similarIssues, setSimilarIssues] = useState<SimilarIssue[] | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [currentIssue, setCurrentIssue] = useState<SuggestedIssue | null>(null);

    const handleCreateIssue = async (suggestion: SuggestedIssue, index: number) => {
        try {
            const response = await fetch('/api/create-issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suggestion, isEpic: false, config }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create issue.');
            }

            toast({
                title: `Issue ${data.issueKey} created successfully.`,
                status: 'success',
                duration: 3000,
                isClosable: true,
            });

            // Remove the created issue from the suggestions list
            setSuggestions((prev) => prev.filter((_, i) => i !== index));
        } catch (error: any) {
            console.error('Error creating issue:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to create issue.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const fetchSimilarIssues = async (suggestedIssue: SuggestedIssue) => {
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

        setIsLoading(true);
        setSimilarIssues(null);
        setCurrentIssue(suggestedIssue);
        setIsModalOpen(true);

        try {
            const response = await fetch('/api/get-similar-issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary: suggestedIssue.summary, config }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch similar issues.');
            }

            setSimilarIssues(data.similarIssues);
        } catch (error: any) {
            console.error('Error fetching similar issues:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to fetch similar issues.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSimilarIssues(null);
        setCurrentIssue(null);
    };

    return (
        <Box my={4}>
            <Heading size="md" mb={4}>
                Suggested Issues
            </Heading>
            <List spacing={4}>
                {suggestions.map((suggestion, index) => (
                    <ListItem key={index} borderWidth="1px" borderRadius="md" p={4}>
                        <VStack align="start" spacing={2}>
                            <Text fontWeight="bold">{suggestion.summary}</Text>
                            <Text>{suggestion.description}</Text>
                            <Text fontStyle="italic" color="gray.600">
                                {suggestion.issuetype}
                            </Text>
                            <Text color="gray.500">{suggestion.explanation}</Text>
                            <HStack spacing={2}>
                                <Button
                                    colorScheme="teal"
                                    onClick={() => handleCreateIssue(suggestion, index)}
                                >
                                    Create in Jira
                                </Button>
                                <Button
                                    colorScheme="blue"
                                    onClick={() => fetchSimilarIssues(suggestion)}
                                >
                                    Show Similar Issues
                                </Button>
                            </HStack>
                        </VStack>
                    </ListItem>
                ))}
            </List>

            {/* Modal to display similar issues */}
            <Modal isOpen={isModalOpen} onClose={closeModal} size="lg">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Similar Issues</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {isLoading ? (
                            <Spinner size="xl" />
                        ) : (
                            <>
                                {currentIssue && (
                                    <Box mb={4}>
                                        <Text fontWeight="bold" mb={2}>
                                            Suggested Issue:
                                        </Text>
                                        <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.100">
                                            <Text fontWeight="bold">{currentIssue.summary}</Text>
                                            <Text fontSize="sm" color="gray.600">
                                                Type: {currentIssue.issuetype}
                                            </Text>
                                        </Box>
                                    </Box>
                                )}
                                {similarIssues && similarIssues.length > 0 ? (
                                    <Box>
                                        <Text fontWeight="bold" mb={2}>
                                            Similar Issues:
                                        </Text>
                                        <List spacing={3}>
                                            {similarIssues.map((issue, idx) => (
                                                <ListItem key={idx} borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                                                    <VStack align="start" spacing={1}>
                                                        <Text color="gray.600">
                                                            {issue.key}: {issue.summary}
                                                        </Text>
                                                        <Text fontSize="sm" color="gray.500">
                                                            Type: {issue.issuetype}
                                                        </Text>
                                                        <Text fontSize="sm" color="gray.400">
                                                            Similarity Score: {issue.similarity.toFixed(6)}
                                                        </Text>
                                                    </VStack>
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Box>
                                ) : (
                                    <Text>No similar issues found.</Text>
                                )}
                            </>
                        )}
                    </ModalBody>


                    <ModalFooter>
                        <Button colorScheme="blue" mr={3} onClick={closeModal}>
                            Close
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default SuggestedIssuesList;
