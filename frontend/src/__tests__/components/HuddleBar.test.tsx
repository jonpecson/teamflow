import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppProvider } from '../../context/AppContext';
import HuddleBar from '../../components/huddle/HuddleBar';
import type { ActiveCall } from '../../api/types';

vi.mock('../../hooks/useCalls', () => ({
  useCalls: () => ({
    joinCall: vi.fn(),
    currentMeetingId: null,
  }),
}));

const mockCall: ActiveCall = {
  meeting_id: 'test-meeting',
  channel_id: 'test-channel',
  channel_name: 'general',
  started_by: 'alice',
  participants: ['alice', 'bob'],
  started_at: new Date().toISOString(),
};

describe('HuddleBar', () => {
  it('renders join button and participant info', () => {
    render(
      <AppProvider>
        <HuddleBar call={mockCall} />
      </AppProvider>
    );
    expect(screen.getByText('Join')).toBeInTheDocument();
    expect(screen.getByText(/alice started a huddle/)).toBeInTheDocument();
  });
});
