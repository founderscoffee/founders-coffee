import { Fragment } from 'react';

const SLOT = /<<VALUE:([^<>]+)>>/;

export type IsolatedValuesProps<Name extends string> = {
  values: Readonly<Record<Name, string>>;
  message: (slots: Readonly<Record<Name, string>>) => string;
};

const slotsFor = <Name extends string>(
  values: Readonly<Record<Name, string>>,
): Record<Name, string> =>
  Object.fromEntries(
    Object.keys(values).map((name) => [name, `<<VALUE:${name}>>`]),
  ) as Record<Name, string>;

export const IsolatedValues = <Name extends string>({
  values,
  message,
}: IsolatedValuesProps<Name>) => (
  <>
    {message(slotsFor(values))
      .split(SLOT)
      .map((part, index) =>
        index % 2 === 1 ? (
          <bdi key={index}>{values[part as Name]}</bdi>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
  </>
);
