import { useQuery } from '@tanstack/react-query'

import { geoApi } from './api'

export const useStates = (countryCode: string) =>
  useQuery({
    queryKey: ['geo', 'states', countryCode],
    queryFn: () => geoApi.getStates({ data: { country: countryCode } }),
  })

export const useCities = (countryCode: string, stateCode: string) =>
  useQuery({
    queryKey: ['geo', 'cities', countryCode, stateCode],
    queryFn: () => geoApi.getCities({ data: { country: countryCode, state: stateCode } }),
    enabled: !!stateCode,
  })
