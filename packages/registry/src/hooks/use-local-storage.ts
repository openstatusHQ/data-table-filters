"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function getItemFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Render `initialValue` first, even in the browser: the server has no access
  // to localStorage, so reading it during the initial render makes the first
  // client render differ from the server HTML and hydration fails. The stored
  // value is picked up right after mount instead.
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const initialValueRef = useRef(initialValue);
  // Set as soon as a value is written, so the post-mount read never overwrites
  // a fresh write (e.g. an interaction that lands before the effect runs).
  const isDirtyRef = useRef(false);
  const isMountRunRef = useRef(true);

  useEffect(() => {
    const isMountRun = isMountRunRef.current;
    isMountRunRef.current = false;
    // Keep a value written before this effect ran; a changed `key` still wins.
    if (isMountRun && isDirtyRef.current) return;
    isDirtyRef.current = false;
    setStoredValue(getItemFromLocalStorage(key, initialValueRef.current));
  }, [key]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      isDirtyRef.current = true;
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        // Save to localStorage asynchronously to avoid blocking UI
        queueMicrotask(() => {
          try {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          } catch {
            // Ignore localStorage errors (quota exceeded, etc.)
          }
        });
        return newValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
