// jira-backlog-cleaner/theme.ts

import { extendTheme } from '@chakra-ui/react';

const colors = {
  jiraRed: {
    50: '#ffe5e0',
    100: '#fbb8b0',
    200: '#f28a7f',
    300: '#ea5c4e',
    400: '#e12d1d',
    500: '#c81404', // This is your #FF5630 color adjusted
    600: '#9e1003',
    700: '#740c02',
    800: '#4a0801',
    900: '#210400',
  },
  jiraOrange: {
    500: '#FFAB00',
  },
  jiraGreen: {
    500: '#36B37E',
  },
  jiraBlue: {
    500: '#00B8D9',
  },
  jiraPurple: {
    500: '#6554C0',
  },
  similarityGreen: {
    500: '#008000',  // Strong Green
  },
  similarityLime: {
    500: '#9acd32',  // Lime Green
  },
  similarityYellow: {
    500: '#ffff00',  // Yellow
  },
  similarityOrange: {
    500: '#ffa500',  // Orange
  },
  similarityGray: {
    500: 'gray',
  },
};

const theme = extendTheme({ colors });

export default theme;
