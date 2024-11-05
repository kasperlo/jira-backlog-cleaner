// components/IssueList.tsx

import { List, ListItem, Text, Button } from '@chakra-ui/react';
import { JiraIssue } from '../types/types';

interface IssueListProps {
    issues: JiraIssue[];
    onAction?: (issue: JiraIssue) => void;
    actionLabel?: string;
    isLoading?: boolean;
}

export function IssueList({ issues, onAction, actionLabel, isLoading }: IssueListProps) {
    return (
        <List spacing={3} mt={2}>
            {issues.map((issue) => (
                <ListItem key={issue.id} borderWidth="1px" borderRadius="md" p={4}>
                    <Text fontWeight="bold">
                        {issue.key}: {issue.fields.summary}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                        Type: {issue.fields.issuetype.name} | Created: {new Date(issue.fields.created).toLocaleDateString()}
                    </Text>
                    {onAction && actionLabel && (
                        <Button mt={2} onClick={() => onAction(issue)} isLoading={isLoading}>
                            {actionLabel}
                        </Button>
                    )}
                </ListItem>
            ))}
        </List>
    );
}
