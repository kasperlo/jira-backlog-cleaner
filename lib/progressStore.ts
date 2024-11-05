// lib/progressStore.ts

import { ProgressData } from "../types/types";

declare global {
  // Declare a global variable to hold the progress data
  // eslint-disable-next-line no-var
  var progressData: ProgressData | undefined;
}

// Ensure global.progressData is initialized
const getProgressData = (): ProgressData => {
  if (!global.progressData) {
    global.progressData = {
      total: 0,
      completed: 0,
      status: 'idle',
    };
  }
  return global.progressData;
};

export const resetProgress = (total: number) => {
  const progressData = getProgressData();
  progressData.total = total;
  progressData.completed = 0;
  progressData.status = 'processing';
  delete progressData.errorMessage;
};

export const updateProgress = () => {
  const progressData = getProgressData();
  if (progressData.status === 'processing') {
    progressData.completed += 1;
  }
};

export const completeProgress = () => {
  const progressData = getProgressData();
  progressData.status = 'completed';
};

export const setError = (message: string) => {
  const progressData = getProgressData();
  progressData.status = 'error';
  progressData.errorMessage = message;
};

export const getProgress = (): ProgressData => {
  return getProgressData();
};

export const setIdle = () => {
  const progressData = getProgressData();
  progressData.total = 0;
  progressData.completed = 0;
  progressData.status = 'idle';
  delete progressData.errorMessage;
};
