// components/IssueList.tsx

import { List } from '@chakra-ui/react';
import { JiraIssue } from '../types/types';
import { IssueItem } from './IssueItem';
import { IssueListHeader } from './IssueListHeader';

interface IssueListProps {
    issues: JiraIssue[];
    onDelete: (issueKey: string) => Promise<void>;
    onExplain: (issueKey: string) => Promise<string>;
    onSuggestSummary: (issueKey: string) => Promise<string>;
    onEditSummary: (issueKey: string, newSummary: string) => Promise<void>;
    actionInProgress?: boolean;
}

export function IssueList({
    issues,
    onDelete,
    onExplain,
    onSuggestSummary,
    onEditSummary,
    actionInProgress,
}: IssueListProps) {
    return (
        <>
            <IssueListHeader />
            <List spacing={3} mt={2}>
                {issues.map((issue) => (
                    <IssueItem
                        key={issue.id}
                        issue={issue}
                        onDelete={onDelete}
                        onExplain={onExplain}
                        onSuggestSummary={onSuggestSummary}
                        onEditSummary={onEditSummary}
                        actionInProgress={actionInProgress}
                    />
                ))}
            </List>
        </>
    );
}
