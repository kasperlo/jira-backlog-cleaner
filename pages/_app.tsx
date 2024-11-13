// pages/_app.tsx

import { ChakraProvider } from '@chakra-ui/react';
import type { AppProps } from 'next/app';
import theme from '../theme'; // Import the custom theme
import { JiraProvider } from '@/context/JiraContext';

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <ChakraProvider theme={theme}>
            <JiraProvider>
                <Component {...pageProps} />
            </JiraProvider>
        </ChakraProvider>
    );
}

export default MyApp;
