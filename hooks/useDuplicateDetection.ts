// hooks/useDuplicateDetection.ts

import { useState } from 'react';
import axios from 'axios';
import { DuplicateGroup, JiraIssue } from '../types/types';
import { useJira } from '../context/JiraContext';
import { useToast } from '@chakra-ui/react';

export function useDuplicateDetection(issues: JiraIssue[]) {
  const { config } = useJira();
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState<boolean>(false);
  const [duplicateError, setDuplicateError] = useState<string>('');
  const toast = useToast();

  const detectDuplicates = async () => {
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

    setDuplicateLoading(true);
    setDuplicateError('');
    try {
      const response = await axios.post('/api/detect-duplicates', { issues, config });
      setDuplicates(response.data.duplicates || []);
      toast({
        title: 'Duplicate detection completed.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error('Error detecting duplicates:', err);
      setDuplicateError('Failed to detect duplicates: ' + (err.response?.data?.error || err.message));
      toast({
        title: 'Error detecting duplicates.',
        description: 'Please try again later.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setDuplicateLoading(false);
    }
  };

  return {
    duplicates,
    duplicateLoading,
    duplicateError,
    detectDuplicates,
    setDuplicates,
  };
}
