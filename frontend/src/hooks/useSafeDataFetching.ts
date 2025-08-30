import { useRef, useCallback } from 'react';

interface UseSafeDataFetchingOptions {
  cooldownMs?: number;
  maxCallsPerMinute?: number;
}

export const useSafeDataFetching = (options: UseSafeDataFetchingOptions = {}) => {
  const { cooldownMs = 2000, maxCallsPerMinute = 5 } = options;
  
  const lastCallTime = useRef<number>(0);
  const callCount = useRef<number>(0);
  const callCountResetTime = useRef<number>(Date.now());
  const isActiveRef = useRef<boolean>(false);

  const canMakeCall = useCallback((): boolean => {
    const now = Date.now();
    
    // Reset call count every minute
    if (now - callCountResetTime.current > 60000) {
      callCount.current = 0;
      callCountResetTime.current = now;
    }
    
    // Check if we're still in cooldown
    if (now - lastCallTime.current < cooldownMs) {
      console.log('useSafeDataFetching: Call blocked - in cooldown');
      return false;
    }
    
    // Check if we've exceeded max calls per minute
    if (callCount.current >= maxCallsPerMinute) {
      console.log('useSafeDataFetching: Call blocked - max calls per minute exceeded');
      return false;
    }
    
    // Check if a call is already active
    if (isActiveRef.current) {
      console.log('useSafeDataFetching: Call blocked - another call is active');
      return false;
    }
    
    return true;
  }, [cooldownMs, maxCallsPerMinute]);

  const safeFetch = useCallback(async <T>(
    fetchFunction: () => Promise<T>,
    context: string = 'Unknown'
  ): Promise<T | null> => {
    if (!canMakeCall()) {
      return null;
    }

    console.log(`useSafeDataFetching: Starting safe fetch for ${context}`);
    
    lastCallTime.current = Date.now();
    callCount.current += 1;
    isActiveRef.current = true;

    try {
      const result = await fetchFunction();
      console.log(`useSafeDataFetching: Safe fetch completed for ${context}`);
      return result;
    } catch (error) {
      console.error(`useSafeDataFetching: Safe fetch failed for ${context}:`, error);
      throw error;
    } finally {
      isActiveRef.current = false;
    }
  }, [canMakeCall]);

  const getStats = useCallback(() => ({
    lastCallTime: lastCallTime.current,
    callCount: callCount.current,
    isActive: isActiveRef.current,
    cooldownRemaining: Math.max(0, cooldownMs - (Date.now() - lastCallTime.current)),
  }), [cooldownMs]);

  return {
    safeFetch,
    canMakeCall,
    getStats,
  };
};
