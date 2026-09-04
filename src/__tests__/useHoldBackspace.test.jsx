import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { useHoldBackspace } from '../hooks/useHoldBackspace.js';

function TestBackspaceButton({ onBackspace, onClear, delay = 350, interval = 70, holdClearDelay = 1100, disabled = false }) {
  const handlers = useHoldBackspace({ onBackspace, onClear, delay, interval, holdClearDelay, disabled });
  return <button type="button" {...handlers}>Delete</button>;
}

describe('useHoldBackspace Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('triggers onBackspace once on a short tap and ignores duplicate synthetic click', () => {
    const onBackspace = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(<TestBackspaceButton onBackspace={onBackspace} onClear={onClear} />);
    const btn = getByText('Delete');

    fireEvent.pointerDown(btn, { button: 0, pointerId: 1 });
    expect(onBackspace).toHaveBeenCalledTimes(1);

    // Release after 100ms (before delay)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(btn, { pointerId: 1 });
    fireEvent.click(btn);

    // No additional calls from click or delay
    expect(onBackspace).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('auto-repeats onBackspace after delay when held', () => {
    const onBackspace = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(
      <TestBackspaceButton
        onBackspace={onBackspace}
        onClear={onClear}
        delay={350}
        interval={70}
        holdClearDelay={1100}
      />
    );
    const btn = getByText('Delete');

    fireEvent.pointerDown(btn, { button: 0, pointerId: 1 });
    expect(onBackspace).toHaveBeenCalledTimes(1);

    // Advance 350ms to reach delay threshold
    act(() => {
      vi.advanceTimersByTime(350);
    });
    // First repeat interval tick at 350 + 70 = 420ms
    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(onBackspace).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(140); // 2 more ticks
    });
    expect(onBackspace).toHaveBeenCalledTimes(4);

    fireEvent.pointerUp(btn, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Stops repeating after pointerUp
    expect(onBackspace).toHaveBeenCalledTimes(4);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('calls onClear and halts after holdClearDelay is reached', () => {
    const onBackspace = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(
      <TestBackspaceButton
        onBackspace={onBackspace}
        onClear={onClear}
        delay={350}
        interval={70}
        holdClearDelay={1100}
      />
    );
    const btn = getByText('Delete');

    fireEvent.pointerDown(btn, { button: 0, pointerId: 1 });
    expect(onBackspace).toHaveBeenCalledTimes(1);

    // Advance to 1100ms
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(onClear).toHaveBeenCalledTimes(1);
    const backspaceCallsAtClear = onBackspace.mock.calls.length;

    // Further time should not trigger more backspace or clear
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onBackspace).toHaveBeenCalledTimes(backspaceCallsAtClear);
    expect(onClear).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(btn, { pointerId: 1 });
  });

  it('handles keyboard activation via click without prior pointerdown', () => {
    const onBackspace = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(<TestBackspaceButton onBackspace={onBackspace} onClear={onClear} />);
    const btn = getByText('Delete');

    fireEvent.click(btn);
    expect(onBackspace).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const onBackspace = vi.fn();
    const onClear = vi.fn();
    const { getByText } = render(
      <TestBackspaceButton onBackspace={onBackspace} onClear={onClear} disabled={true} />
    );
    const btn = getByText('Delete');

    fireEvent.pointerDown(btn, { button: 0, pointerId: 1 });
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(onBackspace).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });
});
