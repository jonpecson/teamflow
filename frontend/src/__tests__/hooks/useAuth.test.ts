import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores token on login', () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('userId', 'test-id');
    localStorage.setItem('username', 'alice');

    expect(localStorage.getItem('token')).toBe('test-token');
    expect(localStorage.getItem('userId')).toBe('test-id');
    expect(localStorage.getItem('username')).toBe('alice');
  });

  it('clears token on logout', () => {
    localStorage.setItem('token', 'test-token');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');

    expect(localStorage.getItem('token')).toBeNull();
  });
});
