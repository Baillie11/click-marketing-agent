import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

describe('account access', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Authentication required' }) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('offers account creation and forgotten-password recovery', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Sign in to your workspace' })).toBeTruthy();
    expect(screen.getByText('Create an account')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeTruthy();
  });

  it('renders a token-based password reset form', () => {
    window.history.replaceState({}, '', `/reset-password?token=${'a'.repeat(43)}`);
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeTruthy();
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm new password')).toBeTruthy();
  });
});
