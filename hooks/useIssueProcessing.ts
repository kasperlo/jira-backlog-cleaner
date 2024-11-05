// hooks/useIssueProcessing.ts

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { JiraIssue, ProgressData, JiraConfig } from '../types/types';
import { useJira } from '../context/JiraContext';
import { useToast } from '@chakra-ui/react';

export function useIssueProcessing() {
  const { config } = useJira();
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData>({
    total: 0,
    completed: 0,
    status: 'idle',
  });
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const toast = useToast();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    setProcessing(true);
    setProgress({
      total: 0,
      completed: 0,
      status: 'processing',
    });
    setIssues([]);
    setError('');

    try {
      const response = await axios.post('/api/issues', {
        config,
        action: 'process',
      });

      if (response.status === 202) {
        toast({
          title: 'Processing Started',
          description: 'Issue processing has begun.',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });

        // Start polling progress and issues
        startPolling();
      } else {
        throw new Error('Failed to start processing.');
      }
    } catch (error: any) {
      console.error('Error starting processing:', error);
      setProcessing(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start processing.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const startPolling = () => {
    // Clear any existing intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Fetch progress
        const progressResponse = await axios.get('/api/progress');
        const progressData: ProgressData = progressResponse.data;
        setProgress(progressData);

        // Update progress percentage
        const percentage =
          progressData.total > 0 ? (progressData.completed / progressData.total) * 100 : 0;
        setProgressPercentage(percentage);

        // Fetch processed issues
        const issuesResponse = await axios.post('/api/issues', {
          config,
          action: 'fetchProcessedIssues',
        });
        setIssues(issuesResponse.data.issues || []);

        // Check if processing is completed or errored
        if (progressData.status === 'completed') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          setProcessing(false);
          toast({
            title: 'Processing Completed',
            description: `${issuesResponse.data.issues.length} issues have been processed successfully.`,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
        } else if (progressData.status === 'error') {
          clearInterval(pollingIntervalRef.current!);
          pollingIntervalRef.current = null;
          setProcessing(false);
          toast({
            title: 'Processing Error',
            description: progressData.errorMessage || 'An error occurred during processing.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error('Error during polling:', error);
        clearInterval(pollingIntervalRef.current!);
        pollingIntervalRef.current = null;
        setProcessing(false);
        toast({
          title: 'Error',
          description: 'An error occurred during polling.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }, 2000); // Poll every 2 seconds
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchIssuesData = async () => {
    if (!config) return;
    setProcessing(true);
    setError('');
    try {
      const response = await axios.post('/api/issues', { config, action: 'fetch' });
      setIssues(response.data.issues || []);
      toast({
        title: 'Issues fetched successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error('Error fetching issues:', err);
      setError('Failed to fetch Jira issues. Please check your configuration.');
      toast({
        title: 'Error fetching issues.',
        description: 'Please check your Jira configuration and try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  return {
    issues,
    processing,
    progress,
    progressPercentage,
    error,
    startProcessing,
    fetchIssuesData,
  };
}
