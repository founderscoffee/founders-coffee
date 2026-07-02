import { useQuery } from '@tanstack/react-query'

import { marketsApi } from './api'

export const useVisibleMarkets = () =>
  useQuery({
    queryKey: ['markets', 'visible'],
    queryFn: () => marketsApi.getVisibleMarkets(),
  })

export const useMarketLanding = (marketCode: string) =>
  useQuery({
    queryKey: ['markets', 'landing', marketCode],
    queryFn: () => marketsApi.getMarketLanding({ data: { marketCode } }),
  })

export const useCityLanding = (marketCode: string, cityCode: string) =>
  useQuery({
    queryKey: ['markets', 'city', marketCode, cityCode],
    queryFn: () => marketsApi.getCityLanding({ data: { marketCode, cityCode } }),
  })
