// components/PriorityBadge.tsx

import React from 'react';
import { HStack, Text, Icon } from '@chakra-ui/react';
import { IconType } from 'react-icons';

interface PriorityBadgeProps {
    priority: string;
    icon: IconType;
    color: string; // Text and icon color
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
    priority,
    icon,
    color,
    size = 'md',
}) => {
    // Define size mappings
    const sizeProps = {
        xs: {
            fontSize: 'xs',
            iconSize: 3,
        },
        sm: {
            fontSize: 'sm',
            iconSize: 3,
        },
        md: {
            fontSize: 'sm',
            iconSize: 5,
        },
        lg: {
            fontSize: 'md',
            iconSize: 5,
        },
        xl: {
            fontSize: 'lg',
            iconSize: 6,
        },
    };

    const currentSize = sizeProps[size];

    return (
        <HStack spacing={1}>
            <Icon as={icon} boxSize={currentSize.iconSize} color={color} />
            <Text fontSize={currentSize.fontSize}>
                {priority}
            </Text>
        </HStack>
    );
};
