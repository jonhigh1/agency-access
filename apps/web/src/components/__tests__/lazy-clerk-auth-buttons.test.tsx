import { cloneElement, type ReactElement, type MouseEventHandler } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInButton, SignUpButton } from '../lazy-clerk-auth-buttons';
import { Button } from '../ui/button';

const { openSignIn, openSignUp } = vi.hoisted(() => ({
  openSignIn: vi.fn(),
  openSignUp: vi.fn(),
}));

// Keep the shared wrapper real. Model Clerk's child-handler composition only.
vi.mock('@clerk/nextjs', () => {
  type Props = {
    children: ReactElement<{ onClick?: MouseEventHandler<HTMLButtonElement> }>;
    mode?: string;
  };
  const authButton = (open: typeof openSignIn) => ({ children, mode }: Props) =>
    cloneElement(children, {
      onClick: async (event) => {
        await children.props.onClick?.(event);
        open({ mode });
      },
    });

  return {
    SignInButton: authButton(openSignIn),
    SignUpButton: authButton(openSignUp),
  };
});

describe('public authentication buttons', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    ['Sign In', SignInButton, openSignIn],
    ['Get Started', SignUpButton, openSignUp],
  ] as const)('opens authentication on the first %s click, including before effects settle', async (label, AuthButton, open) => {
    const prepare = vi.fn();
    render(
      <AuthButton mode="modal">
        <Button onClick={prepare}>{label}</Button>
      </AuthButton>
    );

    // Do not await here: an early click must not disappear during lazy loading.
    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith({ mode: 'modal' }));
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0]);
  });
});
