// components/IssueListSkeleton.tsx

import { List, ListItem, Skeleton, SkeletonText } from '@chakra-ui/react';

interface IssueListSkeletonProps {
    itemCount: number;
}

export function IssueListSkeleton({ itemCount }: IssueListSkeletonProps) {
    return (
        <List spacing={3} mt={2}>
            {Array.from({ length: itemCount }).map((_, index) => (
                <ListItem key={index} borderWidth="1px" borderRadius="md" p={4}>
                    <Skeleton height="20px" width="70%" mb={2} />
                    <SkeletonText mt="4" noOfLines={1} spacing="4" />
                    <Skeleton height="36px" width="100px" mt={4} borderRadius="md" />
                </ListItem>
            ))}
        </List>
    );
}
