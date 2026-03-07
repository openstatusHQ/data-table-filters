import { useEffect, useRef } from "react";

export function useHotKey(callback: () => void, key: string): void {
  // Use ref to always have the latest callback without re-registering the listener
  const callbackRef = useRef(callback);
  // eslint-disable-next-line react-hooks/refs
  callbackRef.current = callback;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === key && (e.metaKey || e.ctrlKey)) {
        // e.preventDefault();
        callbackRef.current();
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [key]);
}
