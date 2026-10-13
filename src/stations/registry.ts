import type { StationModule } from './types'

// One lazy chunk per station. A station missing here shows as "Đang dựng" on the map.
export const STATIONS: Partial<Record<number, () => Promise<{ default: StationModule }>>> = {
  1: () => import('./t01/index'),
  2: () => import('./t02/index'),
  3: () => import('./t03/index'),
  4: () => import('./t04/index'),
  5: () => import('./t05/index'),
  6: () => import('./t06/index'),
  7: () => import('./t07/index'),
  8: () => import('./t08/index'),
  9: () => import('./t09/index'),
  10: () => import('./t10/index'),
  11: () => import('./t11/index'),
  12: () => import('./t12/index'),
  13: () => import('./t13/index'),
  14: () => import('./t14/index'),
  15: () => import('./t15/index'),
  16: () => import('./t16/index'),
  17: () => import('./t17/index'),
  18: () => import('./t18/index'),
}
