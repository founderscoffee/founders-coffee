import { IsolatedValues } from './IsolatedValues.js';

export type IsolatedValueProps = {
  value: string;
  message: (value: string) => string;
};

export const IsolatedValue = ({ value, message }: IsolatedValueProps) => (
  <IsolatedValues values={{ value }} message={(slot) => message(slot.value)} />
);
