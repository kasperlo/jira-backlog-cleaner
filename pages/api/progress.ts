// pages/api/progress.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getProgress } from '../../lib/progressStore';
import { ProgressData } from '../../types/types';

export default function handler(req: NextApiRequest, res: NextApiResponse<ProgressData>) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).end('Method Not Allowed');
      console.warn(`Method ${req.method} not allowed on /api/progress`);
      return;
    }
  
    const progress = getProgress();
    console.log(`Progress endpoint accessed. Current status: ${progress.status}`);
  
    res.status(200).json(progress);
  }
  
