import { useCallback, useRef } from "react";

export const useTripleClick = (callback: () => void, delay = 500) => {
  const clickCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    clickCount.current += 1;
    if (clickCount.current === 3) {
      clickCount.current = 0;
      if (timer.current) clearTimeout(timer.current);
      callback();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      clickCount.current = 0;
    }, delay);
  }, [callback, delay]);

  return handleClick;
};
