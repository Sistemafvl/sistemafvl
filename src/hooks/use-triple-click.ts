import { useRef, useCallback } from "react";

interface UseTripleClickOptions {
  onTripleClick: () => void;
  timeout?: number;
}

export function useTripleClick({ onTripleClick, timeout = 500 }: UseTripleClickOptions) {
  const clickCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    clickCount.current += 1;

    if (timer.current) clearTimeout(timer.current);

    if (clickCount.current === 3) {
      clickCount.current = 0;
      onTripleClick();
      return;
    }

    timer.current = setTimeout(() => {
      clickCount.current = 0;
    }, timeout);
  }, [onTripleClick, timeout]);

  return handleClick;
}
