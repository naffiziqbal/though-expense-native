import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { parseExpenseInputLocally } from '../lib/utils';

const MAX_LENGTH = 120;

/**
 * Offers the clipboard as a one-tap expense when it looks like one
 * ("coffee 120"), so a copied amount from a payment app is a single tap away.
 * Each clipboard value is offered once per session.
 */
export function useClipboardCapture(currentInput: string): {
  suggestion: string | null;
  dismiss: () => void;
} {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          if (!(await Clipboard.hasStringAsync())) return;
          const text = (await Clipboard.getStringAsync())?.trim();
          if (cancelled || !text || text.length > MAX_LENGTH) return;
          if (seen.current.has(text)) return;
          if (currentInput.trim().includes(text)) return;

          // Only offer it if our local parser can find a description + amount.
          const parsed = parseExpenseInputLocally(text);
          if (parsed.length === 0) return;

          setSuggestion(text);
        } catch {
          // Clipboard access denied or unavailable.
        }
      })();

      return () => {
        cancelled = true;
      };
      // Intentionally keyed on focus only; re-running on every keystroke would
      // re-read the clipboard constantly.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const dismiss = useCallback(() => {
    setSuggestion((current) => {
      if (current) seen.current.add(current);
      return null;
    });
  }, []);

  return { suggestion, dismiss };
}
