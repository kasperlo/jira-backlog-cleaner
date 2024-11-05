// context/JiraContext.tsx

'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface JiraConfig {
    jiraEmail: string;
    jiraApiToken: string;
    jiraBaseUrl: string;
    projectKey: string;
}

interface JiraContextProps {
    config: JiraConfig | null;
    setConfig: (config: JiraConfig) => void;
}

const JiraContext = createContext<JiraContextProps | undefined>(undefined);

export const JiraProvider = ({ children }: { children: ReactNode }) => {
    const [config, setConfigState] = useState<JiraConfig | null>(null);

    useEffect(() => {
        // Optionally, load config from localStorage or another persistence layer
        const storedConfig = localStorage.getItem('jiraConfig');
        if (storedConfig) {
            setConfigState(JSON.parse(storedConfig));
        }
    }, []);

    const setConfig = (newConfig: JiraConfig) => {
        setConfigState(newConfig);
        // Optionally, persist config to localStorage or another storage
        localStorage.setItem('jiraConfig', JSON.stringify(newConfig));
    };

    return (
        <JiraContext.Provider value={{ config, setConfig }}>
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
