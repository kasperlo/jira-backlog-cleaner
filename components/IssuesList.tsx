// components/IssuesList.tsx

import { IssueList } from './IssueList';
import { JiraIssue } from '../types/types';

interface IssuesListProps {
    issues: JiraIssue[];
    onDelete: (issueKey: string) => void;
    actionInProgress: boolean;
}

export function IssuesList({ issues, onDelete, actionInProgress }: IssuesListProps) {
    return (
        <IssueList
            issues={issues}
            onAction={(issue) => onDelete(issue.key)}
            actionLabel="Delete Issue"
            isLoading={actionInProgress}
        />
    );
}
