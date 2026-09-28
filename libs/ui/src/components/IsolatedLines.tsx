import { Fragment } from 'react';

export type IsolatedLinesProps = {
  text: string;
};

export const IsolatedLines = ({ text }: IsolatedLinesProps) => (
  <>
    {text.split('\n').map((line, index) => (
      <Fragment key={index}>
        {index > 0 ? '\n' : null}
        <bdi>{line}</bdi>
      </Fragment>
    ))}
  </>
);
