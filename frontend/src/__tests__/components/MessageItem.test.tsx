import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MessageItem from '../../components/messages/MessageItem';
import type { MessageData } from '../../api/types';

const mockMsg: MessageData = {
  id: 'msg-1',
  channel_id: 'ch-1',
  user_id: 'user-1',
  username: 'alice',
  content: 'Hello world',
  timestamp: new Date().toISOString(),
};

describe('MessageItem', () => {
  it('renders message content and username', () => {
    render(<MessageItem message={mockMsg} isOwn={false} isCompact={false} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('renders compact mode without avatar', () => {
    const { container } = render(<MessageItem message={mockMsg} isOwn={false} isCompact={true} />);
    expect(container.querySelector('.msg.compact')).toBeInTheDocument();
    expect(container.querySelector('.msg-avatar')).not.toBeInTheDocument();
  });

  it('renders own message with own class', () => {
    const { container } = render(<MessageItem message={mockMsg} isOwn={true} isCompact={false} />);
    expect(container.querySelector('.msg.own')).toBeInTheDocument();
  });

  it('linkifies URLs in messages', () => {
    const urlMsg = { ...mockMsg, content: 'Check https://example.com out' };
    const { container } = render(<MessageItem message={urlMsg} isOwn={false} isCompact={false} />);
    const link = container.querySelector('a.msg-link') as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toContain('example.com');
  });
});
