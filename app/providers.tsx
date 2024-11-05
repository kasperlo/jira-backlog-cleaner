// app/providers.tsx

'use client';

import { ReactNode } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { JiraProvider } from '../context/JiraContext';

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ChakraProvider>
            <JiraProvider>{children}</JiraProvider>
        </ChakraProvider>
    );
}
