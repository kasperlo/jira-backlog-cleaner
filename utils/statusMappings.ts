// utils/statusMappings.ts

import { IconType } from 'react-icons';
import { FiCircle, FiRefreshCw, FiCheckCircle, FiPauseCircle } from 'react-icons/fi';

export const statusColorMap: { [key: string]: { bg: string; color: string } } = {
  'To Do': { bg: '#C1C7D0', color: 'white' },       // jira grey
  'In Progress': { bg: '#0052CC', color: 'white' }, // jira blue
  'Done': { bg: '#36B37E', color: 'white' },        // Green
  'Review': { bg: '#FFAB00', color: 'white' },      // Orange
  'Blocked': { bg: '#FF5630', color: 'white' },     // Red
};

export const statusIconMap: { [key: string]: IconType } = {
  'To Do': FiCircle,
  'In Progress': FiRefreshCw,
  'Done': FiCheckCircle,
  'Review': FiPauseCircle,
  'Blocked': FiPauseCircle,
};
