// hooks/useIssueProcessing.ts

import { useState } from 'react';
import axios from 'axios';
import { JiraIssue } from '../types/types';
import { useJira } from '../context/JiraContext';
import { useToast } from '@chakra-ui/react';

export function useIssueProcessing() {
  const { config } = useJira();
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const toast = useToast();

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
    setIssues([]);
    setError('');

    try {
      const response = await axios.post('/api/issues', {
        config,
        action: 'process',
      });

      if (response.status === 200) {
        const { issues } = response.data;
        setIssues(issues);

        toast({
          title: 'Processing Completed',
          description: `${issues.length} issues have been processed successfully.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(response.data.error || 'Failed to process issues.');
      }
    } catch (error: any) {
      console.error('Error processing issues:', error);
      setError(error.message || 'Failed to process issues.');
      toast({
        title: 'Error',
        description: error.message || 'Failed to process issues.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  const fetchIssuesData = async () => {
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
    setError('');

    try {
      const response = await axios.post('/api/issues', {
        config,
        action: 'fetch',
      });

      if (response.status === 200) {
        const { issues } = response.data;
        setIssues(issues);

        toast({
          title: 'Issues Fetched',
          description: `${issues.length} issues have been fetched successfully.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(response.data.error || 'Failed to fetch issues.');
      }
    } catch (error: any) {
      console.error('Error fetching issues:', error);
      setError(error.message || 'Failed to fetch issues.');
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch issues.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setProcessing(false);
    }
  };

  return {
    issues,
    setIssues, // Expose setIssues here
    processing,
    error,
    startProcessing,
    fetchIssuesData,
  };
}
