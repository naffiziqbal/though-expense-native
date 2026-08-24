import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/** Fetch the user's actual categories from their expense summary. */
export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.getCategorySummary();
        if (mounted && response.success && response.data.byCategory) {
          setCategories(Object.keys(response.data.byCategory));
        }
      } catch {
        if (mounted) setCategories([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { categories, isLoading };
}
