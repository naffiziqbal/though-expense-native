import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Return target when opening a hidden tab screen (tab bar stays visible; stack history does not). */
export type HiddenTabBackParam = { back?: string };

type ExpoRouter = ReturnType<typeof useRouter>;

export function pushHiddenTab(router: ExpoRouter, pathname: Href, back: Href) {
  router.push({ pathname, params: { back: String(back) } } as never);
}

/** Chevron back for hidden tab routes — uses `back` param, then history, then fallback. */
export function useScreenBack(fallback: Href = '/(tabs)/profile') {
  const router = useRouter();
  const { back } = useLocalSearchParams<HiddenTabBackParam>();

  return useCallback(() => {
    if (typeof back === 'string' && back.startsWith('/')) {
      router.navigate(back as Href);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.navigate(fallback);
  }, [router, back, fallback]);
}
