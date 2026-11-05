import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommitInput } from './CommitInput';

function setup(onCommit: (value: string) => boolean | undefined = () => undefined) {
  const spy = vi.fn(onCommit);
  render(<CommitInput aria-label="Campo" value="1h" onCommit={spy} />);
  return { spy, input: screen.getByRole<HTMLInputElement>('textbox', { name: 'Campo' }) };
}

describe('CommitInput', () => {
  it('saves on Enter, not on every keystroke', async () => {
    const { spy, input } = setup();
    await userEvent.type(input, '{Backspace}{Backspace}2h');
    expect(spy).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(spy).toHaveBeenCalledExactlyOnceWith('2h');
  });

  it('does not save when nothing changed', async () => {
    const { spy, input } = setup();
    await userEvent.click(input);
    await userEvent.tab();
    expect(spy).not.toHaveBeenCalled();
  });

  it('restores the value when rejected', async () => {
    const { input } = setup(() => false);
    await userEvent.clear(input);
    await userEvent.type(input, 'abc{Enter}');
    expect(input.value).toBe('1h');
  });

  it('cancels with Escape', async () => {
    const { spy, input } = setup();
    await userEvent.type(input, 'x{Escape}');
    await userEvent.tab();
    expect(input.value).toBe('1h');
    expect(spy).not.toHaveBeenCalled();
  });
});
