// components/StatusBadge.tsx

import React from 'react';
import { Badge, HStack, Text, Icon } from '@chakra-ui/react';
import { IconType } from 'react-icons';

interface StatusBadgeProps {
    status: string;
    icon: IconType;
    bgColor: string;
    textColor: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    icon,
    bgColor,
    textColor,
    size = 'md',
}) => {
    // Define size mappings
    const sizeProps = {
        xs: {
            badgeWidth: '60px',
            height: '24px',
            fontSize: 'xs',
            iconSize: 3,
            paddingX: 2,
        },
        sm: {
            badgeWidth: '80px',
            height: '25px',
            fontSize: 'sm',
            iconSize: 3,
            paddingX: 2,
        },
        md: {
            badgeWidth: '100px',
            height: '32px',
            fontSize: 'md',
            iconSize: 4,
            paddingX: 2,
        },
        lg: {
            badgeWidth: '120px',
            height: '36px',
            fontSize: 'lg',
            iconSize: 5,
            paddingX: 2,
        },
        xl: {
            badgeWidth: '140px',
            height: '40px',
            fontSize: 'xl',
            iconSize: 6,
            paddingX: 3,
        },
    };

    const currentSize = sizeProps[size];

    return (
        <Badge
            bg={bgColor}
            color={textColor}
            variant="solid"
            borderRadius="full"
            w={currentSize.badgeWidth}
            height={currentSize.height}
            display="flex"
            alignItems="center"
            justifyContent="center"
            px={currentSize.paddingX}
        >
            <HStack spacing={1}>
                <Icon as={icon} boxSize={currentSize.iconSize} />
                <Text fontSize={currentSize.fontSize} whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                    {status}
                </Text>
            </HStack>
        </Badge>
    );
};
