import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoRefreshOptions {
  /** Interval in seconds between auto-refreshes */
  intervalSeconds: number;
  /** The function to call when the timer hits zero or the user clicks refresh */
  onRefresh: () => void | Promise<void>;
  /** Whether to trigger a refresh immediately on mount */
  refreshOnMount?: boolean;
}

interface UseAutoRefreshReturn {
  /** Remaining seconds as a formatted "MM:SS" string */
  countdown: string;
  /** Raw remaining seconds */
  secondsLeft: number;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Call to manually trigger a refresh and reset the timer */
  triggerRefresh: () => void;
}

export function useAutoRefresh({
  intervalSeconds,
  onRefresh,
  refreshOnMount = false,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);

  // Keep the ref in sync so we don't need to re-register the interval on every render
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setSecondsLeft(intervalSeconds); // reset timer immediately
    try {
      await onRefreshRef.current();
    } finally {
      setIsRefreshing(false);
    }
  }, [intervalSeconds]);

  // Kick off an initial refresh if requested
  useEffect(() => {
    if (refreshOnMount) triggerRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main countdown tick — runs every second
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Trigger async refresh without blocking the interval
          setIsRefreshing(true);
          Promise.resolve(onRefreshRef.current()).finally(() => setIsRefreshing(false));
          return intervalSeconds; // reset
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [intervalSeconds]);

  // Format as MM:SS
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { countdown, secondsLeft, isRefreshing, triggerRefresh };
}
