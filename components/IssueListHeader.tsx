// jira-backlog-cleaner/components/IssueListHeader.tsx

import { HStack, Text, Box } from '@chakra-ui/react';

export function IssueListHeader() {
    return (
        <HStack spacing={4} p={4} borderBottomWidth="1px">
            <Box flex="1">
                <Text fontWeight="bold">Issue Key</Text>
            </Box>
            <Box flex="3">
                <Text fontWeight="bold">Summary</Text>
            </Box>
            <Box flex="1">
                <Text fontWeight="bold">Issue Type</Text>
            </Box>
            <Box flex="1">
                <Text fontWeight="bold">Created</Text>
            </Box>
            <Box flex="1">
                <Text fontWeight="bold">Actions</Text>
            </Box>
        </HStack>
    );
}
