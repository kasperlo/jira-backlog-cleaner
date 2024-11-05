// components/IssueProgress.tsx

import React, { useState, useEffect } from 'react';
import {
    Button,
    Text,
    VStack,
    Spinner,
    useToast,
    CircularProgress,
    CircularProgressLabel,
} from '@chakra-ui/react';
import { useJira } from '../context/JiraContext';

interface ProgressData {
    total: number;
    completed: number;
    status: 'idle' | 'processing' | 'completed' | 'error';
    errorMessage?: string;
}

interface IssueProgressProps {
    onProcessingCompleted?: () => void;
}

const IssueProgress: React.FC<IssueProgressProps> = ({ onProcessingCompleted }) => {
    const [progress, setProgress] = useState<ProgressData>({
        total: 0,
        completed: 0,
        status: 'idle',
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const toast = useToast();
    const { config } = useJira();

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isProcessing) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch('/api/progress');
                    const data: ProgressData = await response.json();
                    setProgress(data);

                    if (data.status === 'completed' || data.status === 'idle') {
                        console.log(`Processing ${data.status}. Stopping polling.`);
                        clearInterval(interval); // Stop polling
                        setIsProcessing(false);   // Update state to stop polling
                        toast({
                            title: 'Process Update',
                            description: data.status === 'completed' ?
                                'All issues processed successfully.' :
                                'Processing is idle.',
                            status: 'info',
                            duration: 5000,
                            isClosable: true,
                        });

                        if (onProcessingCompleted && data.status === 'completed') {
                            onProcessingCompleted();
                        }
                    } else if (data.status === 'error') {
                        console.log("Error encountered. Stopping polling.");
                        clearInterval(interval);
                        setIsProcessing(false);
                        toast({
                            title: 'Process Error',
                            description: data.errorMessage || 'An error occurred during processing.',
                            status: 'error',
                            duration: 5000,
                            isClosable: true,
                        });
                    }
                } catch (error) {
                    console.error('Error fetching progress:', error);
                    clearInterval(interval);
                    setIsProcessing(false);
                    toast({
                        title: 'Network Error',
                        description: 'Failed to fetch progress updates.',
                        status: 'error',
                        duration: 5000,
                        isClosable: true,
                    });
                }
            }, 2000); // Poll every 2 seconds
        }

        return () => {
            if (interval) clearInterval(interval); // Clear interval on component unmount or state change
        };
    }, [isProcessing, toast, onProcessingCompleted]);

    const startProcessing = async () => {
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

        setIsProcessing(true);
        setProgress({
            total: 0,
            completed: 0,
            status: 'processing',
        });

        try {
            const response = await fetch('/api/issues', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    config,
                    action: 'process',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start processing.');
            }

            toast({
                title: 'Processing Started',
                description: 'Issue processing has begun.',
                status: 'info',
                duration: 3000,
                isClosable: true,
            });
        } catch (error: any) {
            console.error('Error starting processing:', error);
            setIsProcessing(false);
            toast({
                title: 'Error',
                description: error.message || 'Failed to start processing.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const progressPercentage =
        progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

    return (
        <VStack spacing={4} mt={6}>
            <Button
                colorScheme="teal"
                onClick={startProcessing}
                isDisabled={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Start Processing Issues'}
            </Button>

            {isProcessing && (
                <VStack spacing={2}>
                    <CircularProgress
                        value={progressPercentage}
                        color="teal.400"
                        size="120px"
                        thickness="8px"
                    >
                        <CircularProgressLabel>
                            {Math.round(progressPercentage)}%
                        </CircularProgressLabel>
                    </CircularProgress>
                    <Text>
                        {progress.completed} / {progress.total} issues processed
                    </Text>
                    <Spinner />
                </VStack>
            )}

            {!isProcessing && progress.status === 'completed' && (
                <Text color="green.500">All issues have been processed.</Text>
            )}

            {!isProcessing && progress.status === 'error' && (
                <Text color="red.500">
                    Error: {progress.errorMessage || 'Unknown error occurred.'}
                </Text>
            )}
        </VStack>
    );
};

export default IssueProgress;
