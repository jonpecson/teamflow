import { useCallback } from 'react';
import { api } from '../api/client';
import { useAppState, useAppDispatch } from '../context/AppContext';
import type { OnlineUser, User } from '../api/types';

export function usePresence() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const loadUsers = useCallback(async () => {
    const [users, online] = await Promise.all([
      api.listUsers() as Promise<User[]>,
      api.onlineUsers() as Promise<OnlineUser[]>,
    ]);
    dispatch({ type: 'SET_USERS', users: users.map((u) => ({ id: u.id, username: u.username })) });
    dispatch({ type: 'SET_ONLINE_USERS', users: online });
  }, [dispatch]);

  return {
    allUsers: state.allUsers,
    onlineUsers: state.onlineUsers,
    loadUsers,
  };
}
