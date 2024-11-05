// app/layout.tsx

import './globals.css';
import { Providers } from './providers'; // Adjust the path as needed

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Jira Backlog Manager</title>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
