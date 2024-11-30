// jira-backlog-cleaner/components/Header.tsx

import { Box, Heading } from '@chakra-ui/react';
import { useJira } from '../context/JiraContext';

const Header = () => {
    const { projectTitle } = useJira();

    return (
        <Box as="header" mb={6}>
            <Heading as="h1" size="xl">
                {projectTitle ? `${projectTitle}` : 'Jira Backlog Manager'}
            </Heading>
        </Box>
    );
};

export default Header;
