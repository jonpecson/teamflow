import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Hash, MessageSquare, User } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { api } from '../../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface MessageResult {
  id: string;
  channel_id: string;
  channel_name: string;
  username: string;
  headline: string;
  created_at: string;
}

interface SearchResults {
  messages: MessageResult[];
  channels: { id: string; name: string; is_dm: boolean }[];
  users: { id: string; username: string; display_name?: string; avatar_url?: string }[];
}

export default function CommandPalette({ open, onClose }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<SearchResults | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setApiResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setApiResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.search(query) as SearchResults;
        setApiResults(results);
      } catch {
        // ignore search errors
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelectChannel = useCallback(
    (channelId: string) => {
      dispatch({ type: 'SELECT_CHANNEL', channelId });
      onClose();
    },
    [dispatch, onClose],
  );

  const handleSelectUser = useCallback(
    async (userId: string) => {
      try {
        const dm = (await api.getOrCreateDm(userId)) as { id: string; name: string; is_dm: boolean; created_at: string; created_by: string };
        dispatch({ type: 'ADD_DM_CHANNEL', channel: dm });
        dispatch({ type: 'ADD_MY_CHANNEL', channelId: dm.id });
        dispatch({ type: 'SELECT_CHANNEL', channelId: dm.id });
      } catch {
        // ignore
      }
      onClose();
    },
    [dispatch, onClose],
  );

  const handleSelectMessage = useCallback(
    (channelId: string) => {
      dispatch({ type: 'SELECT_CHANNEL', channelId });
      onClose();
    },
    [dispatch, onClose],
  );

  // Local channel/user filtering for instant results
  const localChannels = query.trim()
    ? state.channels.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : state.channels.slice(0, 8);

  const localUsers = query.trim()
    ? state.allUsers.filter((u) => u.username.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  return (
    <CommandDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <CommandInput
        placeholder="Search channels, users, messages..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {localChannels.length > 0 && (
          <CommandGroup heading="Channels">
            {localChannels.map((ch) => (
              <CommandItem key={ch.id} value={`channel-${ch.name}`} onSelect={() => handleSelectChannel(ch.id)}>
                <Hash size={16} className="mr-2 opacity-50" />
                {ch.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {localUsers.length > 0 && (
          <CommandGroup heading="Users">
            {localUsers.map((u) => (
              <CommandItem key={u.id} value={`user-${u.username}`} onSelect={() => handleSelectUser(u.id)}>
                <User size={16} className="mr-2 opacity-50" />
                {u.username}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {apiResults?.messages && apiResults.messages.length > 0 && (
          <CommandGroup heading="Messages">
            {apiResults.messages.map((msg) => (
              <CommandItem
                key={msg.id}
                value={`msg-${msg.id}`}
                onSelect={() => handleSelectMessage(msg.channel_id)}
              >
                <MessageSquare size={16} className="mr-2 opacity-50 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs opacity-60">
                    #{msg.channel_name} &middot; {msg.username}
                  </div>
                  <div className="truncate text-sm" dangerouslySetInnerHTML={{ __html: msg.headline.replace(/<<(.+?)>>/g, '<mark>$1</mark>') }} />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
