// hooks/usePersistentState.ts

import { useState, useEffect } from 'react';

export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    }
    return initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}
