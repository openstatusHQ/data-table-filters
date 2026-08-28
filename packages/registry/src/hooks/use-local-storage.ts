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
  // Which key was last written to, so the post-mount read never overwrites a
  // fresh write (e.g. an interaction that lands before the effect runs). Scoped
  // to the key rather than a bare boolean: a write followed by a `key` change
  // before the mount effect flushed would otherwise skip hydration for the new
  // key, which never had a write of its own.
  const dirtyKeyRef = useRef<string | null>(null);
  const isMountRunRef = useRef(true);

  // Declared before the effect below so it runs first: effects fire in hook
  // order, and the read needs the defaults belonging to the *current* key, not
  // the ones captured on the first render.
  useEffect(() => {
    initialValueRef.current = initialValue;
  });

  useEffect(() => {
    const isMountRun = isMountRunRef.current;
    isMountRunRef.current = false;
    // Keep a value written before this effect ran; a changed `key` still wins.
    if (isMountRun && dirtyKeyRef.current === key) return;
    dirtyKeyRef.current = null;
    setStoredValue(getItemFromLocalStorage(key, initialValueRef.current));
  }, [key]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      dirtyKeyRef.current = key;
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
