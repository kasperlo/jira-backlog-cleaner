import { Box, Text, VStack, HStack } from '@chakra-ui/react';
import { JiraIssue, Subtask } from '../types/types';
import { IssueTypeBadge } from './IssueTypeBadge';
import { issueTypeColorMap, issueTypeIconMap } from '../utils/issueTypeMappings';
import { SubtasksList } from './SubtasksList';

interface IssueCardProps {
    issue: JiraIssue;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue }) => {
    // Check if issue fields and issuetype exist to avoid runtime errors
    const issueType = issue.fields?.issuetype?.name || 'Unknown';
    const issueTypeColors = issueTypeColorMap[issueType] || { bg: 'gray', color: 'white' };
    const issueTypeIcon = issueTypeIconMap[issueType];
    const subtasks: Subtask[] = issue.fields?.subtasks || []; // Explicitly type as JiraSubtask[]

    // Determine heights based on presence of subtasks
    const hasSubtasks = subtasks.length > 0;
    const topHeight = '50px'; // 15% of 500px
    const middleHeight = hasSubtasks ? '275px' : '450px'; // 50% or 85% of 500px
    const bottomHeight = '175px'; // 35% of 500px

    return (
        <Box
            borderWidth="1px"
            borderRadius="md"
            p={4}
            width="500px"
            height="500px"
            m={2}
            overflow="hidden"
            display="flex"
            flexDirection="column"
        >
            {/* Top Section: 15% / 75px */}
            <Box height={topHeight} overflow="hidden">
                <HStack width="100%" justifyContent="space-between" h="100%">
                    {/* Left: IssueTypeBadge and Issue Key */}
                    <HStack>
                        <IssueTypeBadge
                            issueType={issueType}
                            icon={issueTypeIcon}
                            bgColor={issueTypeColors.bg}
                            textColor={issueTypeColors.color}
                            size="sm"
                        />
                        <Text fontWeight="bold" fontSize="sm">
                            {issue.key}
                        </Text>
                    </HStack>
                    {/* Right: Created Date */}
                    <Text fontSize="sm">
                        Created: {issue.fields?.created ? new Date(issue.fields.created).toLocaleDateString() : 'N/A'}
                    </Text>
                </HStack>
            </Box>

            {/* Middle Section: 50% / 250px or 85% / 425px */}
            <Box height={middleHeight} overflow="auto">
                <VStack align="start" spacing={2} height="100%">
                    {/* Issue Summary */}
                    <Text fontSize="lg" fontWeight="bold">
                        {issue.fields?.summary || 'No summary available'}
                    </Text>

                    {/* Issue Description */}
                    {issue.fields?.description && (
                        <Text color="gray.600">
                            {issue.fields.description}
                        </Text>
                    )}
                </VStack>
            </Box>

            {/* Bottom Section: 35% / 175px (only if subtasks exist) */}
            {hasSubtasks && (
                <Box height={bottomHeight} overflow="auto">
                    <SubtasksList subtasks={subtasks} />
                </Box>
            )}
        </Box>
    );
};
