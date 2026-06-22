import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { type Stock } from '@/types';

export function useStockList() {
  return useQuery<Stock[], Error>({
    queryKey: ['stocks', 'list'],
    queryFn: async () => invoke<Stock[]>('get_stock_list'),
  });
}

export function useSearchStocks(query: string) {
  return useQuery<Stock[], Error>({
    queryKey: ['stocks', 'search', query],
    queryFn: async () => invoke<Stock[]>('search_stocks', { query }),
    enabled: query.length > 0,
  });
}

export function useStockDetail(id: string) {
  return useQuery<Stock | null, Error>({
    queryKey: ['stocks', 'detail', id],
    queryFn: async () => invoke<Stock | null>('get_stock_detail', { id }),
    enabled: id.length > 0,
  });
}
