// components/JiraConfigForm.tsx

'use client';

import { useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    Alert,
    AlertIcon,
    Spinner,
    Textarea,
} from '@chakra-ui/react';
import axios from 'axios';
import { useJira } from '../context/JiraContext';
import { JiraConfig } from '../types/types';

const JiraConfigForm = () => {
    const { setConfig, setProjectTitle, setProjectDescription } = useJira(); // Updated to include setProjectDescription
    const [localConfig, setLocalConfig] = useState<JiraConfig>({
        jiraEmail: '',
        jiraApiToken: '',
        jiraBaseUrl: '',
        projectKey: '',
    });
    const [localProjectDescription, setLocalProjectDescription] = useState<string>(''); // New state for project description
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'projectDescription') {
            setLocalProjectDescription(value);
        } else {
            setLocalConfig({
                ...localConfig,
                [name]: value.trim(),
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (
            !localConfig.jiraEmail ||
            !localConfig.jiraApiToken ||
            !localConfig.jiraBaseUrl ||
            !localConfig.projectKey
        ) {
            setError('All fields are required.');
            return;
        }

        // Optional: Validate project key format
        const projectKeyPattern = /^[A-Z]+$/;
        if (!projectKeyPattern.test(localConfig.projectKey)) {
            setError('Project key must contain only uppercase letters.');
            return;
        }

        setLoading(true);

        try {
            // Call the validation API route
            const response = await axios.post('/api/validate-jira-config', {
                config: localConfig,
            });

            if (response.data.success) {
                setConfig(localConfig);
                setProjectTitle(response.data.projectTitle); // Store the project title
                setProjectDescription(localProjectDescription); // Store the project description
            } else {
                setError(response.data.message);
            }
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to validate Jira configuration.';
            console.error('Error validating Jira configuration:', errorMessage);
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box p={4} borderWidth="1px" borderRadius="md" mb={6}>
            <form onSubmit={handleSubmit}>
                <VStack spacing={4}>
                    <FormControl id="jiraEmail" isRequired>
                        <FormLabel>Jira Email</FormLabel>
                        <Input
                            type="email"
                            name="jiraEmail"
                            value={localConfig.jiraEmail}
                            onChange={handleChange}
                            placeholder="your-email@example.com"
                        />
                    </FormControl>

                    <FormControl id="jiraApiToken" isRequired>
                        <FormLabel>Jira API Token</FormLabel>
                        <Input
                            type="password"
                            name="jiraApiToken"
                            value={localConfig.jiraApiToken}
                            onChange={handleChange}
                            placeholder="your-jira-api-token"
                        />
                    </FormControl>

                    <FormControl id="jiraBaseUrl" isRequired>
                        <FormLabel>Jira Base URL</FormLabel>
                        <Input
                            type="url"
                            name="jiraBaseUrl"
                            value={localConfig.jiraBaseUrl}
                            onChange={handleChange}
                            placeholder="https://your-jira-instance.atlassian.net"
                        />
                    </FormControl>

                    <FormControl id="projectKey" isRequired>
                        <FormLabel>Project Key</FormLabel>
                        <Input
                            type="text"
                            name="projectKey"
                            value={localConfig.projectKey}
                            onChange={handleChange}
                            placeholder="Project Key (e.g., 'BG')"
                        />
                    </FormControl>

                    <FormControl id="projectDescription">
                        <FormLabel>Project Description</FormLabel>
                        <Textarea
                            name="projectDescription"
                            value={localProjectDescription}
                            onChange={handleChange}
                            placeholder="Enter your project description here..."
                            rows={4}
                        />
                    </FormControl>

                    {error && (
                        <Alert status="error">
                            <AlertIcon />
                            {error}
                        </Alert>
                    )}

                    <Button
                        type="submit"
                        colorScheme="teal"
                        width="full"
                        isDisabled={loading}
                    >
                        {loading ? <Spinner size="sm" /> : 'Save Configuration'}
                    </Button>
                </VStack>
            </form>
        </Box>
    );
};

export default JiraConfigForm;
