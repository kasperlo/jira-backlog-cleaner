// components/JiraProviderWrapper.tsx

'use client';

import { JiraProvider } from '../context/JiraContext';
import { ReactNode } from 'react';

interface JiraProviderWrapperProps {
    children: ReactNode;
}

const JiraProviderWrapper = ({ children }: JiraProviderWrapperProps) => {
    return <JiraProvider>{children}</JiraProvider>;
};

export default JiraProviderWrapper;
