import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppProvider } from '../../context/AppContext';
import AuthScreen from '../../components/auth/AuthScreen';

function renderAuth() {
  return render(
    <AppProvider>
      <AuthScreen />
    </AppProvider>
  );
}

describe('AuthScreen', () => {
  it('renders sign in form by default', () => {
    renderAuth();
    expect(screen.getAllByText('Sign In')).toHaveLength(2); // tab + submit button
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('switches to register tab', () => {
    renderAuth();
    fireEvent.click(screen.getByText('Sign Up'));
    expect(screen.getByPlaceholderText('Invite code (e.g. TF-A3X9K2)')).toBeInTheDocument();
  });

  it('hides invite code on login tab', () => {
    renderAuth();
    expect(screen.queryByPlaceholderText('Invite code (e.g. TF-A3X9K2)')).not.toBeInTheDocument();
  });

  it('renders TeamFlow branding', () => {
    renderAuth();
    expect(screen.getByText('TeamFlow')).toBeInTheDocument();
    expect(screen.getByText('Fast chat for small teams')).toBeInTheDocument();
  });
});
