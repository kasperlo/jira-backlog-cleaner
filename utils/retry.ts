// utils/retry.ts

export async function retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 5,
    initialDelay: number = 1000, // in ms
    maxDelay: number = 16000, // in ms
    multiplier: number = 2
  ): Promise<T> {
    let attempt = 0;
    let delay = initialDelay;
  
    while (attempt < retries) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error.response?.status;
  
        // Retry only on 429 (rate limit) or 5xx (server errors)
        if (status === 429 || (status >= 500 && status < 600)) {
          attempt++;
          if (attempt === retries) {
            throw error;
          }
  
          console.warn(`Retry attempt ${attempt} for error ${status}. Retrying in ${delay}ms...`);
          
          // Respect the 'Retry-After' header if provided
          const retryAfter = error.response?.headers?.['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
  
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          delay = Math.min(delay * multiplier, maxDelay); // Exponential backoff
        } else {
          throw error; // Non-retryable error
        }
      }
    }
    throw new Error('Max retries exceeded');
  }
  