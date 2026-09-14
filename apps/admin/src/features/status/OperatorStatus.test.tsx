import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/auth', () => ({ authClient: { signOut: vi.fn() } }));

const { OperatorStatus } = await import('./OperatorStatus');

const status = {
  email: 'founder@founders.coffee',
  name: 'Founder',
  role: 'moderator',
  permissions: ['operations:read', 'audit:read'],
};

afterEach(() => cleanup());

describe('the operator status screen', () => {
  it('names the account and the role it is acting as', () => {
    render(<OperatorStatus locale="en" status={status} isError={false} />);

    expect(screen.getByText('founder@founders.coffee')).toBeTruthy();
    expect(screen.getByText('moderator')).toBeTruthy();
  });

  it('lists the permissions the table actually granted', () => {
    render(<OperatorStatus locale="en" status={status} isError={false} />);

    expect(screen.getByText('operations:read')).toBeTruthy();
    expect(screen.getByText('audit:read')).toBeTruthy();
    expect(screen.queryByText('closeout:override')).toBeNull();
  });

  it('says it is loading rather than rendering an empty operator', () => {
    render(<OperatorStatus locale="en" status={undefined} isError={false} />);

    expect(screen.getByRole('status').textContent).toMatch(/Loading/i);
  });

  it('explains a failed read rather than showing a blank screen', () => {
    render(<OperatorStatus locale="en" status={undefined} isError />);

    expect(screen.getByRole('alert').textContent).toMatch(
      /could not be loaded/i,
    );
  });

  it('renders in the operator’s language', () => {
    render(<OperatorStatus locale="ar" status={status} isError={false} />);

    expect(screen.getByText('الدور')).toBeTruthy();
  });

  it('offers a way out', () => {
    render(<OperatorStatus locale="en" status={status} isError={false} />);

    expect(screen.getByRole('button', { name: /Sign out/i })).toBeTruthy();
  });
});
