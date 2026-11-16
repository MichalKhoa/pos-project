import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LanguageProvider } from '../i18n/LanguageContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import { useConfirm } from '../context/useConfirm';

// Replacement for window.confirm / window.alert (audit F-010).
function Harness({ options, onResult, mode = 'confirm' }) {
  const { askConfirm, notify } = useConfirm();
  return (
    <button
      type="button"
      onClick={async () => onResult(mode === 'confirm' ? await askConfirm(options) : await notify(options))}
    >
      open
    </button>
  );
}

const setup = async (options, mode) => {
  const onResult = vi.fn();
  render(
    <LanguageProvider>
      <ConfirmProvider>
        <Harness options={options} onResult={onResult} mode={mode} />
      </ConfirmProvider>
    </LanguageProvider>
  );
  fireEvent.click(screen.getByText('open'));
  await screen.findByRole('alertdialog');
  return onResult;
};

describe('ConfirmProvider', () => {
  it('resolves true on confirm', async () => {
    const onResult = await setup({ message: 'Smazat?' });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Smazat?');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Potvrdit' })));
    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resolves false on cancel', async () => {
    const onResult = await setup({ message: 'Smazat?' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zrušit' })));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('resolves false on Escape', async () => {
    const onResult = await setup({ message: 'Znovu?' });
    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('the typed-word variant keeps the button disabled until the word is typed', async () => {
    const onResult = await setup({ message: 'Smazat vše?', typeWord: 'SMAZAT', confirmLabel: 'Smazat' });
    const button = screen.getByRole('button', { name: 'Smazat' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'smaz' } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'smazat' } });
    expect(button).toBeEnabled();
    await act(async () => fireEvent.click(button));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('notify shows one OK button and resolves when it is pressed', async () => {
    const onResult = await setup('Chyba při čtení', 'notify');
    expect(screen.queryByRole('button', { name: 'Zrušit' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'OK' })));
    expect(onResult).toHaveBeenCalled();
  });

  it('without a provider a confirmation is refused', async () => {
    const onResult = vi.fn();
    render(<Harness options={{ message: 'x' }} onResult={onResult} />);
    await act(async () => fireEvent.click(screen.getByText('open')));
    expect(onResult).toHaveBeenCalledWith(false);
  });
});
