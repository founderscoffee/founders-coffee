import type { ReactNode } from 'react';

type ButtonRowProps = {
  children: ReactNode;
};

export const ButtonRow = ({ children }: ButtonRowProps) => (
  <div className="grid grid-flow-col auto-cols-[1fr] gap-2">{children}</div>
);
