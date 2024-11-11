// context/JiraContext.tsx

'use client';

import { JiraConfig } from '../types/types';
import { createContext, useContext, ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

interface JiraContextProps {
    config: JiraConfig | null;
    setConfig: (config: JiraConfig) => void;
    projectDescription: string;
    setProjectDescription: (desc: string) => void;
}

const JiraContext = createContext<JiraContextProps | undefined>(undefined);

export const JiraProvider = ({ children }: { children: ReactNode }) => {
    const [config, setConfig] = usePersistentState<JiraConfig | null>('jiraConfig', null);
    const [projectDescription, setProjectDescription] = usePersistentState<string>('projectDescription', '');

    return (
        <JiraContext.Provider value={{ config, setConfig, projectDescription, setProjectDescription }}>
            {children}
        </JiraContext.Provider>
    );
};

export const useJira = () => {
    const context = useContext(JiraContext);
    if (!context) {
        throw new Error('useJira must be used within a JiraProvider');
    }
    return context;
};
