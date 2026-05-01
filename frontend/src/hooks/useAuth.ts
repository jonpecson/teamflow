import { useCallback } from 'react';
import { api } from '../api/client';
import { useAppState, useAppDispatch } from '../context/AppContext';

interface LoginResponse {
  token?: string;
  user_id?: string;
  username?: string;
  mfa_required?: boolean;
}

export function useAuth() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const login = useCallback(async (username: string, password: string): Promise<LoginResponse> => {
    const data = await api.login(username, password) as LoginResponse;

    // If MFA required, return the response without logging in
    if (data.mfa_required) {
      return data;
    }

    // Normal login
    if (data.token && data.user_id && data.username) {
      dispatch({ type: 'LOGIN', token: data.token, userId: data.user_id, username: data.username });
    }
    return data;
  }, [dispatch]);

  const validateMfa = useCallback(async (userId: string, code: string) => {
    const data = await api.validateMfa(userId, code) as LoginResponse;
    if (data.token && data.user_id && data.username) {
      dispatch({ type: 'LOGIN', token: data.token, userId: data.user_id, username: data.username });
    }
  }, [dispatch]);

  const register = useCallback(async (username: string, password: string, inviteCode?: string) => {
    const data = await api.register(username, password, inviteCode) as LoginResponse;
    if (data.token && data.user_id && data.username) {
      dispatch({ type: 'LOGIN', token: data.token, userId: data.user_id, username: data.username });
    }
  }, [dispatch]);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    dispatch({ type: 'LOGOUT' });
  }, [dispatch]);

  return {
    isAuthenticated: !!state.token,
    token: state.token,
    userId: state.userId,
    username: state.username,
    login,
    validateMfa,
    register,
    logout,
  };
}
