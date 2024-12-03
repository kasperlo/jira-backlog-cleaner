// components/ProjectDescriptionPanel.tsx

import React, { useState } from 'react';
import {
    Box,
    Heading,
    Text,
    IconButton,
    Button,
    VStack,
    useToast,
    Tooltip,
    Textarea,
    HStack,
} from '@chakra-ui/react';
import { EditIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useJira } from '../context/JiraContext';
import SuggestedIssuesList from './SuggestedIssuesList';
import { SuggestedIssue } from '../types/types';

interface ProjectDescriptionPanelProps {
    suggestions: SuggestedIssue[];
    setSuggestions: React.Dispatch<React.SetStateAction<SuggestedIssue[]>>;
}

const ProjectDescriptionPanel: React.FC<ProjectDescriptionPanelProps> = ({
    suggestions,
    setSuggestions,
}) => {
    const { projectDescription, setProjectDescription, config } = useJira();
    const [isEditing, setIsEditing] = useState(false);
    const [localDescription, setLocalDescription] = useState(projectDescription);
    // const [ loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [loadingProjectDescription, setLoadingProjectDescription] = useState(false);
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const toast = useToast();

    const handleEditToggle = () => {
        if (isEditing) {
            setProjectDescription(localDescription); // Save changes
        }
        setIsEditing(!isEditing); // Toggle edit mode
    };

    const handleCancelEdit = () => {
        setLocalDescription(projectDescription); // Revert to original
        setIsEditing(false); // Exit edit mode
    };

    /*  const handleGetIssueSuggestions = async () => {
         setLoadingSuggestions(true);
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
 
             setSuggestions(data.suggestions);
             toast({
                 title: 'Suggestions received.',
                 status: 'success',
                 duration: 3000,
                 isClosable: true,
             });
         } catch (error: unknown) {
             console.error('Error getting suggestions:', error);
             toast({
                 title: 'Error',
                 description:
                     error instanceof Error ? error.message : 'Failed to get suggestions.',
                 status: 'error',
                 duration: 5000,
                 isClosable: true,
             });
         } finally {
             setLoadingSuggestions(false);
         }
     };
  */
    const handleSuggestProjectDescription = async () => {
        setLoadingProjectDescription(true);
        try {
            const response = await fetch('/api/suggest-project-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectDescription, config }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to suggest project description.');
            }

            setNewProjectDescription(data.newProjectDescription);
            toast({
                title: 'New project description received.',
                status: 'success',
                duration: 3000,
                isClosable: true,
            });
        } catch (error: unknown) {
            console.error('Error suggesting project description:', error);
            toast({
                title: 'Error',
                description:
                    error instanceof Error ? error.message : 'Failed to suggest project description.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setLoadingProjectDescription(false);
        }
    };

    return (
        <Box>
            <VStack align="start" spacing={4}>
                <HStack width="100%">
                    <Heading size="md">Project Description</Heading>
                    <HStack spacing={2}>
                        {isEditing ? (
                            <>
                                <Tooltip label="Save changes">
                                    <IconButton
                                        icon={<CheckIcon color={"green"} />}
                                        size="sm"
                                        onClick={handleEditToggle}
                                        aria-label="Save Project Description"
                                    />
                                </Tooltip>
                                <Tooltip label="Cancel editing">
                                    <IconButton
                                        icon={<CloseIcon color={"red"} />}
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        aria-label="Cancel Editing"
                                    />
                                </Tooltip>
                            </>
                        ) : (
                            <Tooltip label="Edit Project Description">
                                <IconButton
                                    icon={<EditIcon />}
                                    size="sm"
                                    onClick={handleEditToggle}
                                    aria-label="Edit Project Description"
                                />
                            </Tooltip>
                        )}
                    </HStack>
                </HStack>
                {isEditing ? (
                    <Textarea
                        value={localDescription}
                        onChange={(e) => setLocalDescription(e.target.value)}
                        rows={6}
                    />
                ) : (
                    <Text fontStyle="italic" color="gray.600">
                        {projectDescription}
                    </Text>
                )}
                {/* <Button
                    colorScheme="teal"
                    onClick={handleGetIssueSuggestions}
                    isLoading={loadingSuggestions}
                    width="100%"
                >
                    Get Issue Suggestions
                </Button> */}
                <Button
                    colorScheme="blue"
                    onClick={handleSuggestProjectDescription}
                    isLoading={loadingProjectDescription}
                    width="100%"
                >
                    Suggest Project Description
                </Button>
                {newProjectDescription && (
                    <Box>
                        <Text fontWeight="bold">Suggested Project Description:</Text>
                        <Text fontStyle="italic" color="gray.600">
                            {newProjectDescription}
                        </Text>
                    </Box>
                )}
            </VStack>
            {suggestions.length > 0 && (
                <Box mt={6}>
                    <SuggestedIssuesList suggestions={suggestions} setSuggestions={setSuggestions} />
                </Box>
            )}
        </Box>
    );
};

export default ProjectDescriptionPanel;
