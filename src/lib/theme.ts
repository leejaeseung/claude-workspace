import { useColorScheme } from 'react-native';

import type { Direction } from './types';

// Korean market convention: rising = red, falling = blue.
const light = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  subtext: '#6C6C70',
  border: '#E5E5EA',
  accent: '#3B5BDB',
  input: '#E3E3E8',
  up: '#E03131',
  down: '#1C7ED6',
  neutral: '#868E96',
  upSoft: '#FFE3E3',
  downSoft: '#D0EBFF',
  neutralSoft: '#E9ECEF',
  // Metric verdicts use green/orange so they never read as price up/down (red/blue).
  good: '#2B8A3E',
  bad: '#D9480F',
  goodSoft: '#D3F9D8',
  badSoft: '#FFE8CC',
};

const dark: typeof light = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#F2F2F7',
  subtext: '#9A9AA0',
  border: '#2C2C2E',
  accent: '#748FFC',
  input: '#2C2C2E',
  up: '#FF6B6B',
  down: '#4DABF7',
  neutral: '#ADB5BD',
  upSoft: '#3B1A1A',
  downSoft: '#132B40',
  neutralSoft: '#2C2E33',
  good: '#69DB7C',
  bad: '#FFA94D',
  goodSoft: '#173A20',
  badSoft: '#3D2612',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export function dirColor(theme: Theme, d: Direction | number): string {
  const dir = typeof d === 'number' ? (d > 0 ? 'up' : d < 0 ? 'down' : 'neutral') : d;
  return theme[dir];
}

export function dirSoft(theme: Theme, d: Direction): string {
  return theme[`${d}Soft`];
}
