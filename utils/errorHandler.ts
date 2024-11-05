// utils/errorHandler.ts

import { NextApiResponse } from 'next';

export function handleApiError(res: NextApiResponse, error: any) {
  console.error('API Error:', error);
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';
  res.status(status).json({ error: message });
}
