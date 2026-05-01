import { useCallback, useEffect } from 'react';
import { api } from '../api/client';
import { useAppState, useAppDispatch } from '../context/AppContext';
import type { Channel, MessageData } from '../api/types';

export function useChannels() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const loadChannels = useCallback(async () => {
    const [allChannels, myChannels] = await Promise.all([
      api.listChannels() as Promise<Channel[]>,
      api.myChannels() as Promise<Channel[]>,
    ]);

    const channels = allChannels.filter((c) => !c.is_dm);
    const dmChannels = (myChannels as Channel[]).filter((c) => c.is_dm);

    dispatch({ type: 'SET_CHANNELS', channels, dmChannels });
    dispatch({ type: 'SET_MY_CHANNEL_IDS', ids: (myChannels as Channel[]).map((c) => c.id) });

    // Auto-select first channel if none selected, and load its history
    if (!state.currentChannelId && channels.length > 0) {
      const general = channels.find((c) => c.name === 'general');
      const channelId = general?.id || channels[0].id;
      dispatch({ type: 'SELECT_CHANNEL', channelId });
      const history = await api.channelHistory(channelId, 100) as MessageData[];
      dispatch({
        type: 'SET_MESSAGES',
        channelId,
        messages: history.map((m) => ({
          ...m,
          timestamp: m.timestamp || m.created_at || '',
        })),
      });
    }
  }, [dispatch, state.currentChannelId]);

  const selectChannel = useCallback(async (channelId: string) => {
    dispatch({ type: 'SELECT_CHANNEL', channelId });
    dispatch({ type: 'CLEAR_UNREAD', channelId });

    // Load history if not cached
    if (!state.messages.has(channelId)) {
      const history = await api.channelHistory(channelId, 100) as MessageData[];
      dispatch({
        type: 'SET_MESSAGES',
        channelId,
        messages: history.map((m) => ({
          ...m,
          timestamp: m.timestamp || m.created_at || '',
        })),
      });
    }
  }, [dispatch, state.messages]);

  const createChannel = useCallback(async (name: string) => {
    const channel = await api.createChannel(name) as Channel;
    dispatch({ type: 'ADD_CHANNEL', channel });
    dispatch({ type: 'ADD_MY_CHANNEL', channelId: channel.id });
    dispatch({ type: 'SELECT_CHANNEL', channelId: channel.id });
  }, [dispatch]);

  const joinChannel = useCallback(async (channelId: string) => {
    await api.joinChannel(channelId);
    dispatch({ type: 'ADD_MY_CHANNEL', channelId });
  }, [dispatch]);

  const leaveChannel = useCallback(async (channelId: string) => {
    await api.leaveChannel(channelId);
    dispatch({ type: 'REMOVE_MY_CHANNEL', channelId });
  }, [dispatch]);

  const openDm = useCallback(async (userId: string) => {
    const channel = await api.getOrCreateDm(userId) as Channel;
    dispatch({ type: 'ADD_DM_CHANNEL', channel });
    dispatch({ type: 'ADD_MY_CHANNEL', channelId: channel.id });
    dispatch({ type: 'SELECT_CHANNEL', channelId: channel.id });
  }, [dispatch]);

  return {
    channels: state.channels,
    dmChannels: state.dmChannels,
    myChannelIds: state.myChannelIds,
    currentChannelId: state.currentChannelId,
    loadChannels,
    selectChannel,
    createChannel,
    joinChannel,
    leaveChannel,
    openDm,
  };
}
