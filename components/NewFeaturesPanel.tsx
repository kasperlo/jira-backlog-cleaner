// components/NewFeaturesPanel.tsx

import React, { useState } from 'react';
import { Box, Heading, Input, Button, VStack, Text, useToast } from '@chakra-ui/react';
import { useJira } from '../context/JiraContext';
import IssueDetails from './IssueDetails';
import SuggestedIssuesList from './SuggestedIssuesList';
import { SuggestedIssue, JiraIssue } from '../types/types';

const NewFeaturesPanel: React.FC = () => {
    const { projectDescription, config } = useJira();
    const [featureInput, setFeatureInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [similarIssues, setSimilarIssues] = useState<JiraIssue[]>([]);
    const [suggestions, setSuggestions] = useState<SuggestedIssue[]>([]);
    const toast = useToast();

    const handleSubmit = async () => {
        if (!featureInput.trim()) {
            toast({
                title: 'Feature input is empty.',
                description: 'Please enter a desired feature.',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setLoading(true);
        setSimilarIssues([]);
        setSuggestions([]);

        try {
            const response = await fetch('/api/suggest-feature-issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feature: featureInput, projectDescription, config }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process feature.');
            }

            if (data.similarIssues && data.similarIssues.length > 0) {
                setSimilarIssues(data.similarIssues);
            } else if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            }
        } catch (error: unknown) {
            console.error('Error processing feature:', error);
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to process feature.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <VStack align="start" spacing={4}>
                <Heading size="md">New Features</Heading>
                <Input
                    placeholder="Input desired feature here..."
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                />
                <Button
                    colorScheme="teal"
                    onClick={handleSubmit}
                    isLoading={loading}
                    width="100%"
                >
                    Submit
                </Button>
                {similarIssues.length > 0 && (
                    <Box>
                        <Text fontWeight="bold">It seems like this feature is already contemplated</Text>
                        {similarIssues.map((issue) => (
                            <IssueDetails
                                key={issue.key}
                                summary={issue.fields.summary}
                                description={issue.fields.description}
                                status={issue.fields.status?.name}
                                priority={issue.fields.priority?.name}
                                similarity={issue.fields.similarity}
                            />
                        ))}
                    </Box>
                )}
                {suggestions.length > 0 && (
                    <Box mt={6}>
                        <SuggestedIssuesList suggestions={suggestions} setSuggestions={setSuggestions} />
                    </Box>
                )}
            </VStack>
        </Box>
    );
};

export default NewFeaturesPanel;
