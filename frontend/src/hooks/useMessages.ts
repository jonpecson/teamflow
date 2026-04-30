import { useCallback } from 'react';
import { useAppState } from '../context/AppContext';

export function useMessages() {
  const state = useAppState();

  const currentMessages = state.currentChannelId
    ? state.messages.get(state.currentChannelId) || []
    : [];

  const sendMessage = useCallback((send: (msg: object) => void, content: string) => {
    if (!state.currentChannelId || !content.trim()) return;
    send({
      type: 'message',
      channel_id: state.currentChannelId,
      content: content.trim(),
    });
  }, [state.currentChannelId]);

  return { currentMessages, sendMessage };
}
