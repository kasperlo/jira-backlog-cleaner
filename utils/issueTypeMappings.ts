// utils/issueTypeMappings.ts

import { FiCheckSquare, FiBookOpen, FiStar } from 'react-icons/fi';
import { FaBug } from 'react-icons/fa';
import { IconType } from 'react-icons/lib';

export const issueTypeColorMap: { [key: string]: { bg: string; color: string } } = {
  Bug: { bg: '#FF5630', color: 'white' },      // Jira red
  Task: { bg: '#00B8D9', color: 'white' },     // Jira blue
  Story: { bg: '#36B37E', color: 'white' },    // Jira green
  Epic: { bg: '#6554C0', color: 'white' },     // Jira purple
  Subtask: { bg: '#FFAB00', color: 'white' },  // Jira orange
  Deloppgave: { bg: '#FFAB00', color: 'white' },  // Jira orange

  // Add other issue types as needed
};

export const issueTypeIconMap: { [key: string]: IconType } = {
    Bug: FaBug,
    Task: FiCheckSquare,
    Story: FiBookOpen,
    Epic: FiStar,
    Subtask: FiCheckSquare,
    Deloppgave: FiCheckSquare,
    // Add other issue types as needed
  };

