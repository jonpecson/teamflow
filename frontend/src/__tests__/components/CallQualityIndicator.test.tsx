import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CallQualityIndicator from '../../components/huddle/CallQualityIndicator';

describe('CallQualityIndicator', () => {
  it('renders 5 quality bars', () => {
    const { container } = render(<CallQualityIndicator quality={4} />);
    const bars = container.querySelectorAll('.quality-bar');
    expect(bars.length).toBe(5);
  });

  it('colors bars green for high quality', () => {
    const { container } = render(<CallQualityIndicator quality={5} />);
    const bars = container.querySelectorAll('.quality-bar');
    bars.forEach((bar) => {
      expect((bar as HTMLElement).style.background).toBe('var(--success)');
    });
  });

  it('colors bars red for low quality', () => {
    const { container } = render(<CallQualityIndicator quality={1} />);
    const firstBar = container.querySelector('.quality-bar') as HTMLElement;
    expect(firstBar.style.background).toBe('var(--danger)');
  });
});
