'use client';

import { JiraConfig } from '../types/types';
import { createContext, useContext, ReactNode, useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

interface JiraContextProps {
    config: JiraConfig | null;
    setConfig: (config: JiraConfig) => void;
    projectDescription: string;
    setProjectDescription: (desc: string) => void;
    projectTitle: string;
    setProjectTitle: React.Dispatch<React.SetStateAction<string>>;
}

const JiraContext = createContext<JiraContextProps | undefined>(undefined);

export const JiraProvider = ({ children }: { children: ReactNode }) => {
    const [config, setConfig] = usePersistentState<JiraConfig | null>('jiraConfig', null);
    const [projectDescription, setProjectDescription] = usePersistentState<string>('projectDescription', '');
    const [projectTitle, setProjectTitle] = usePersistentState<string>('projectTitle', ''); // Added persistence for title

    return (
        <JiraContext.Provider value={{
            config,
            setConfig,
            projectDescription,
            setProjectDescription,
            projectTitle,
            setProjectTitle,
        }}>
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