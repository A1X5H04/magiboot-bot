export type BootAnimPart = {
  timeframe: {
    value: number | null;
    unit: 'seconds' | 'frames' | 'end';
  }
  type: 'p' | 'c';
  count: number;
  pause: number;
};

export type ValidationRule<T> = (item: T) => string | null;