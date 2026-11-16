import { createContext, useContext } from 'react';

// Replaces window.confirm / window.alert (audit F-010). Needs a ConfirmProvider above it.
//   const { askConfirm, notify } = useConfirm();
//   if (!(await askConfirm({ message, danger: true, typeWord: t('dialogs.type_word_delete') }))) return;
//   await notify(message);
export const ConfirmContext = createContext(null);

// Without a provider nothing can be shown. Refusing is the safe answer for a confirmation.
const NO_PROVIDER = {
  askConfirm: () => Promise.resolve(false),
  notify: (message) => {
    console.warn('notify() called without ConfirmProvider:', message);
    return Promise.resolve();
  }
};

export function useConfirm() {
  return useContext(ConfirmContext) || NO_PROVIDER;
}
