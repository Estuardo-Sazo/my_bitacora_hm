import type { ComponentProps } from 'react';
import { useState } from 'react';

interface Props extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'defaultValue'> {
  value: string;
  /** Receives the final text. Return false to reject it and restore the previous value. */
  onCommit: (value: string) => boolean | undefined;
}

/**
 * Text field that saves when you leave it or press Enter, not on every keystroke, so editing does
 * not trigger one database write per letter. Escape cancels. Parents pass `key={value}` so that
 * an outside change replaces the draft.
 */
export function CommitInput({ value, onCommit, ...inputProps }: Props) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft === value) return;
    if (onCommit(draft) === false) setDraft(value);
  };

  return (
    <input
      {...inputProps}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(value);
      }}
    />
  );
}
