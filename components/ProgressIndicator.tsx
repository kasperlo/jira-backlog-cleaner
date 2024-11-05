// components/ProgressIndicator.tsx

import { VStack, CircularProgress, CircularProgressLabel, Text, Spinner } from '@chakra-ui/react';
import { ProgressData } from '../types/types';

interface ProgressIndicatorProps {
    progressPercentage: number;
    progress: ProgressData;
}

export function ProgressIndicator({ progressPercentage, progress }: ProgressIndicatorProps) {
    return (
        <VStack spacing={4} mt={6}>
            <CircularProgress
                value={progressPercentage}
                color="teal.400"
                size="120px"
                thickness="8px"
            >
                <CircularProgressLabel>{`${Math.round(progressPercentage)}%`}</CircularProgressLabel>
            </CircularProgress>
            <Text>
                {progress.completed} / {progress.total} issues processed
            </Text>
            <Spinner />
        </VStack>
    );
}
