import { useCallback } from 'react';
import { api } from '../api/client';
import { useAppState, useAppDispatch } from '../context/AppContext';
import type { AuthResponse } from '../api/types';

export function useAuth() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.login(username, password) as AuthResponse;
    dispatch({ type: 'LOGIN', token: data.token, userId: data.user_id, username: data.username });
  }, [dispatch]);

  const register = useCallback(async (username: string, password: string, inviteCode?: string) => {
    const data = await api.register(username, password, inviteCode) as AuthResponse;
    dispatch({ type: 'LOGIN', token: data.token, userId: data.user_id, username: data.username });
  }, [dispatch]);

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, [dispatch]);

  return {
    isAuthenticated: !!state.token,
    token: state.token,
    userId: state.userId,
    username: state.username,
    login,
    register,
    logout,
  };
}
