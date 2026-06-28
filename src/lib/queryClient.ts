import { QueryClient } from '@tanstack/react-query';

const KEY = '__cerydra_query_client__';

export function getQueryClient(): QueryClient {
  if (typeof window !== 'undefined') {
    if (!(window as any)[KEY]) {
      (window as any)[KEY] = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
          },
        },
      });
    }
    return (window as any)[KEY];
  }
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
    },
  });
}
