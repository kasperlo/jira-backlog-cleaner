import React, { useState } from 'react';
import { Box, Textarea, Button, VStack, useToast } from '@chakra-ui/react';
import { useJira } from '../context/JiraContext';
import { SuggestedIssue } from '../types/types';

interface SuggestIssuesFormProps {
    onSuggestionsReceived: (suggestions: SuggestedIssue[]) => void;
}

const SuggestIssuesForm: React.FC<SuggestIssuesFormProps> = ({ onSuggestionsReceived }) => {
    const [projectDescription, setProjectDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { config } = useJira();
    const toast = useToast();

    const handleSubmit = async () => {
        if (!projectDescription.trim()) {
            toast({
                title: 'Project description is empty.',
                description: 'Please enter a project description.',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/suggest-new-issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectDescription, config }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get suggestions.');
            }

            onSuggestionsReceived(data.suggestions);
            toast({
                title: 'Suggestions received.',
                status: 'success',
                duration: 3000,
                isClosable: true,
            });
        } catch (error: any) {
            console.error('Error getting suggestions:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to get suggestions.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box my={4}>
            <VStack spacing={4} align="stretch">
                <Textarea
                    placeholder="Enter your project description here..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={6}
                />
                <Button colorScheme="teal" onClick={handleSubmit} isLoading={loading}>
                    Get Issue Suggestions
                </Button>
            </VStack>
        </Box>
    );
};

export default SuggestIssuesForm;
