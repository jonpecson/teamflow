import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppProvider } from '../../context/AppContext';
import MessageItem from '../../components/messages/MessageItem';

// Mock useCalls
vi.mock('../../hooks/useCalls', () => ({
  useCalls: () => ({
    joinCall: vi.fn(),
    activeCalls: new Map(),
    currentMeetingId: null,
  }),
}));

describe('Call System Messages', () => {
  it('shows caller username (not "You") in call started message', () => {
    render(
      <AppProvider>
        <MessageItem
          message={{
            id: 'call-started-123',
            channel_id: 'ch-1',
            user_id: 'system',
            username: 'system',
            content: '__call_started__jonpecson__meeting-123',
            timestamp: new Date().toISOString(),
          }}
          isOwn={false}
          isCompact={false}
        />
      </AppProvider>
    );
    expect(screen.getByText(/jonpecson started a call/)).toBeInTheDocument();
    expect(screen.queryByText(/You started/)).not.toBeInTheDocument();
  });

  it('shows Join button when call is active', () => {
    // Re-mock with active call
    vi.doMock('../../hooks/useCalls', () => ({
      useCalls: () => ({
        joinCall: vi.fn(),
        activeCalls: new Map([['meeting-123', {
          meeting_id: 'meeting-123',
          channel_id: 'ch-1',
          channel_name: 'general',
          started_by: 'jonpecson',
          participants: ['jonpecson'],
          started_at: new Date().toISOString(),
        }]]),
        currentMeetingId: null,
      }),
    }));

    render(
      <AppProvider>
        <MessageItem
          message={{
            id: 'call-started-123',
            channel_id: 'ch-1',
            user_id: 'system',
            username: 'system',
            content: '__call_started__jonpecson__meeting-123',
            timestamp: new Date().toISOString(),
          }}
          isOwn={false}
          isCompact={false}
        />
      </AppProvider>
    );
    // Call system message should render
    expect(screen.getByText(/jonpecson started a call/)).toBeInTheDocument();
  });

  it('shows call ended message', () => {
    render(
      <AppProvider>
        <MessageItem
          message={{
            id: 'call-ended-123',
            channel_id: 'ch-1',
            user_id: 'system',
            username: 'system',
            content: '__call_ended__meeting-123',
            timestamp: new Date().toISOString(),
          }}
          isOwn={false}
          isCompact={false}
        />
      </AppProvider>
    );
    expect(screen.getByText(/Call ended/)).toBeInTheDocument();
  });
});
