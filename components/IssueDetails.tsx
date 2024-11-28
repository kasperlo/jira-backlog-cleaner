// components/IssueDetails.tsx

import React from 'react';
import {
    Box,
    Text,
    VStack,
    Badge,
    HStack,
} from '@chakra-ui/react';

interface IssueDetailsProps {
    key: string;
    summary: string;
    description?: string;
    status?: string;
    priority?: string;
    similarity?: number;
}

const IssueDetails: React.FC<IssueDetailsProps> = ({
    key,
    summary,
    description,
    status,
    priority,
    similarity,
}) => {
    return (
        <Box borderWidth="1px" borderRadius="md" p={4} bg="gray.50" my={2}>
            <VStack align="start" spacing={2}>
                <HStack justifyContent="space-between" width="100%">
                    <Text fontWeight="bold">{key}</Text>
                    {similarity !== undefined && (
                        <Badge colorScheme="blue">Similarity: {similarity.toFixed(6)}</Badge>
                    )}
                </HStack>
                <Text fontWeight="semibold">{summary}</Text>
                {status && (
                    <Text fontSize="sm" color="gray.600">
                        Status: {status}
                    </Text>
                )}
                {priority && (
                    <Text fontSize="sm" color="gray.600">
                        Priority: {priority}
                    </Text>
                )}
                {description && (
                    <Text fontSize="sm" color="gray.500"> {description} </Text>

                )}
            </VStack>
        </Box>
    );
};

export default IssueDetails;
