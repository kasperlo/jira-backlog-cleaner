// components/SubtasksList.tsx

import { Subtask } from '@/types/types';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';

interface SubtasksListProps {
    subtasks: Subtask[];
}

export const SubtasksList: React.FC<SubtasksListProps> = ({ subtasks }) => {
    return (
        <Box
            height="100%"
            overflowY="auto"
            p={2}
            bg="gray.100"
            borderRadius="md"
        >
            <Text fontWeight="bold" mb={2}>
                Subtasks
            </Text>
            <VStack align="start" spacing={1}>
                {subtasks.map((subtask) => (
                    <Box
                        key={subtask.id}
                        p={2}
                        bg="white"
                        borderRadius="md"
                        width="100%"
                        boxShadow="sm"
                    >
                        <HStack>
                            <Text fontSize="sm" fontWeight="bold" isTruncated={false} width={"85px"}>
                                {subtask.key}:
                            </Text>
                            <Text fontSize="sm" justifySelf={"right"} width={"350px"}>
                                {subtask.fields.summary}
                            </Text>
                        </HStack>
                        {/* Optional: Add more details or actions for each subtask */}
                    </Box>
                ))}
            </VStack>
        </Box>
    );
};