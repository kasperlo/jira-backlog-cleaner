// components/SubtaskInputRow.tsx

import { HStack, Input, IconButton } from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';
import React from 'react';

interface SubtaskInputRowProps {
    id: number;
    title: string;
    onChange: (id: number, value: string) => void;
    onConfirm: (id: number) => void;
}

export const SubtaskInputRow: React.FC<SubtaskInputRowProps> = ({ id, title, onChange, onConfirm }) => {
    return (
        <HStack width="100%">
            <Input
                placeholder="Enter subtask title"
                value={title}
                onChange={(e) => onChange(id, e.target.value)}
            />
            <IconButton
                aria-label="Confirm Subtask"
                icon={<CheckIcon />}
                colorScheme="green"
                onClick={() => onConfirm(id)}
                size="sm"
            />
        </HStack>
    );
};