// components/IssuesList.tsx

import { IssueList } from './IssueList';
import { JiraIssue } from '../types/types';

interface IssuesListProps {
    issues: JiraIssue[];
    onDelete: (issueKey: string) => Promise<void>;
    onExplain: (issueKey: string) => Promise<string>;
    onSuggestSummary: (issueKey: string) => Promise<string>;
    onEditSummary: (issueKey: string, newSummary: string) => Promise<void>;
    actionInProgress: boolean;
}

export function IssuesList({
    issues,
    onDelete,
    onExplain,
    onSuggestSummary,
    onEditSummary,
    actionInProgress,
}: IssuesListProps) {
    return (
        <IssueList
            issues={issues}
            onDelete={onDelete}
            onExplain={onExplain}
            onSuggestSummary={onSuggestSummary}
            onEditSummary={onEditSummary}
            actionInProgress={actionInProgress}
        />
    );
}
