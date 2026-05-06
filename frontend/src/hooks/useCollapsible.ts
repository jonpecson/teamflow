import { useState, useCallback } from 'react';

export function useCollapsible(key: string, defaultOpen = true): [boolean, () => void] {
  const storageKey = `tf-collapse-${key}`;
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === 'true' : defaultOpen;
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);

  return [isOpen, toggle];
}
