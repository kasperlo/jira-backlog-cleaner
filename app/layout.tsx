// app/layout.tsx

import './globals.css';
import { ChakraProvider } from '@chakra-ui/react';
import JiraProviderWrapper from '../components/JiraProviderWrapper'; // Adjust the path as needed

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Jira Backlog Manager</title>
        {/* Add any additional meta tags or links here */}
      </head>
      <body>
        <ChakraProvider>
          <JiraProviderWrapper>
            {children}
          </JiraProviderWrapper>
        </ChakraProvider>
      </body>
    </html>
  );
}
