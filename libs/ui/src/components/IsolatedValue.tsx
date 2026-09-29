import { Fragment } from 'react';

const SLOT = '<<VALUE>>';

export type IsolatedValueProps = {
  value: string;
  message: (value: string) => string;
};

export const IsolatedValue = ({ value, message }: IsolatedValueProps) => (
  <>
    {message(SLOT)
      .split(SLOT)
      .map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <bdi>{value}</bdi> : null}
          {part}
        </Fragment>
      ))}
  </>
);
