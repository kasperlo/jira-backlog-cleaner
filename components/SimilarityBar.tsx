// components/SimilarityBar.tsx

import { Box, Text } from '@chakra-ui/react';
import { getGradientColor } from '../utils/colorUtils'; // Adjust the import path as needed

interface SimilarityBarProps {
    similarityScore: number; // Expected to be between 0.5 and 1.0
}

export const SimilarityBar: React.FC<SimilarityBarProps> = ({ similarityScore }) => {
    // Clamp the similarityScore between 0.5 and 1.0
    const clampedScore = Math.min(Math.max(similarityScore, 0.5), 1.0);

    // Calculate the percentage
    const percentage = ((clampedScore)) * 100; // Maps 0.5-1.0 to 0%-100%

    // Get the dynamic color based on the score
    const barColor = getGradientColor(clampedScore);

    return (
        <Box width="100%" mb={4}>
            <Box
                height="20px"
                width="100%"
                bg="gray.200"
                borderRadius="md"
                position="relative"
                overflow="hidden"
            >
                <Box
                    height="100%"
                    width={`${percentage}%`}
                    bg={barColor}
                    borderRadius="md"
                    transition="width 0.3s ease, background-color 0.3s ease"
                >
                    <Text fontSize={"sm"} justifySelf={"center"}>
                        {clampedScore.toFixed(2)} of 1
                    </Text>
                </Box>
            </Box>
        </Box>
    );
};
