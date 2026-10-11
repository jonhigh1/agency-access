import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SignUpScreen from '../sign-up-screen';

const mockPush = vi.fn();
const mockCreate = vi.fn();
const mockPrepareEmailAddressVerification = vi.fn();
const mockAttemptEmailAddressVerification = vi.fn();
const mockAuthenticateWithRedirect = vi.fn();
const mockSetActive = vi.fn();

let mockIsLoaded = true;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@clerk/nextjs', () => ({
  useSignUp: () => ({
    isLoaded: mockIsLoaded,
    isPending: false,
    signUp: {
      create: mockCreate,
      prepareEmailAddressVerification: mockPrepareEmailAddressVerification,
      attemptEmailAddressVerification: mockAttemptEmailAddressVerification,
      authenticateWithRedirect: mockAuthenticateWithRedirect,
      status: null,
      createdSessionId: null,
    },
    setActive: mockSetActive,
  }),
}));

describe('SignUpScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockCreate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });
    mockAttemptEmailAddressVerification.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_1',
    });
  });

  it('renders the headline, subtext, and AuthHub brand', () => {
    render(<SignUpScreen />);

    expect(
      screen.getByRole('heading', { name: /create your free account in 30 seconds/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/join hundreds of agencies onboarding new clients without sharing credentials/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/authhub/i).length).toBeGreaterThan(0);
  });

  it('renders labeled email and password fields with the password rule', () => {
    render(<SignUpScreen />);

    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByText(/password must be at least 8 characters long/i)).toBeInTheDocument();
  });

  it('renders the Sign up submit button and the Google alternative', () => {
    render(<SignUpScreen />);

    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with google/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/or continue with/i)).toBeInTheDocument();
  });

  it('links to sign-in, terms, and the privacy policy', () => {
    render(<SignUpScreen />);

    const signInLink = screen.getByRole('link', { name: /sign in here/i });
    expect(signInLink).toHaveAttribute('href', '/sign-in');

    const termsLink = screen.getByRole('link', { name: /terms and conditions/i });
    expect(termsLink).toHaveAttribute('href', '/terms');

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy');
  });

  it('renders the social-proof panel with the approved Pillar AI testimonial', () => {
    render(<SignUpScreen />);

    expect(
      screen.getByText(/our clients connect their platforms in 5 minutes/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/aj s\./i)).toBeInTheDocument();
    expect(screen.getByText(/co-founder, pillar ai agency/i)).toBeInTheDocument();
  });

  it('creates the account and redirects to onboarding when no verification is required', async () => {
    mockCreate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });
    render(<SignUpScreen />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'founder@agency.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        emailAddress: 'founder@agency.com',
        password: 'correct-horse-battery',
      });
    });
    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_1' });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding/unified');
    });
  });

  it('shows the email-code step when verification is required and verifies the code', async () => {
    mockCreate.mockResolvedValue({ status: 'missing_requirements', createdSessionId: null });
    render(<SignUpScreen />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'founder@agency.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mockPrepareEmailAddressVerification).toHaveBeenCalledWith({
        strategy: 'email_code',
      });
    });
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(mockAttemptEmailAddressVerification).toHaveBeenCalledWith({ code: '123456' });
    });
    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_1' });
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding/unified');
    });
  });

  it('surfaces a readable error when account creation fails', async () => {
    mockCreate.mockRejectedValue(
      new Error('Email address is already taken.')
    );
    render(<SignUpScreen />);

    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'founder@agency.com' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    await waitFor(() => {
      expect(screen.getByText(/email address is already taken/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('starts the Google SSO redirect through the sso-callback route', async () => {
    render(<SignUpScreen />);

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => {
      expect(mockAuthenticateWithRedirect).toHaveBeenCalledWith({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/onboarding/unified',
      });
    });
  });

  it('blocks submission before Clerk is loaded', async () => {
    mockIsLoaded = false;
    render(<SignUpScreen />);

    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
  });
});
