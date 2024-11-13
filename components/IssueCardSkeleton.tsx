// components/IssueCardSkeleton.tsx

import { Box, Skeleton, SkeletonText, VStack, HStack } from '@chakra-ui/react';

interface IssueCardSkeletonProps {
    width?: string | string[];
    height?: string;
}

export const IssueCardSkeleton: React.FC<IssueCardSkeletonProps> = ({ width = '500px', height = '500px' }) => {
    // Define heights based on the IssueCard layout
    const topHeight = '50px'; // 15% of 500px
    const middleHeight = '450px'; // 85% of 500px (assuming no subtasks)

    return (
        <Box
            borderWidth="1px"
            borderRadius="md"
            p={4}
            width={width}
            height={height}
            m={2}
            overflow="hidden"
            display="flex"
            flexDirection="column"
            bg="white"
            boxShadow="md"
        >
            {/* Top Section */}
            <Box height={topHeight} overflow="hidden">
                <HStack width="100%" justifyContent="space-between" h="100%">
                    {/* Left: IssueTypeBadge Skeleton and Issue Key Skeleton */}
                    <HStack>
                        <Skeleton height="20px" width="60px" borderRadius="md" />
                        <Skeleton height="20px" width="100px" borderRadius="md" />
                    </HStack>
                    {/* Right: Created Date Skeleton */}
                    <Skeleton height="20px" width="120px" borderRadius="md" />
                </HStack>
            </Box>

            {/* Middle Section */}
            <Box height={middleHeight} overflow="auto">
                <VStack align="start" spacing={2} height="100%">
                    {/* Issue Summary Skeleton */}
                    <Skeleton height="24px" width="80%" borderRadius="md" />
                    {/* Issue Description Skeleton */}
                    <SkeletonText mt="4" noOfLines={2} spacing="4" />
                </VStack>
            </Box>

            {/* Bottom Section (Optional Subtasks Skeleton) */}
            {/* Uncomment the following block if you want to include a skeleton for subtasks */}
            {false && (
                <Box height="175px" overflow="auto">
                    <VStack align="start" spacing={2}>
                        {Array.from({ length: 3 }).map((_, index) => (
                            <Box key={index} width="100%">
                                <Skeleton height="16px" width="70%" mb={2} borderRadius="md" />
                                <Skeleton height="16px" width="90%" borderRadius="md" />
                            </Box>
                        ))}
                    </VStack>
                </Box>
            )}
        </Box>
    );
};
