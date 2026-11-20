import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { hashDevicePin } from '../utils/offlineDb';

interface AppLockOverlayProps {
  expectedHash: string;
  onUnlock: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({ expectedHash, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const candidateHash = await hashDevicePin(pin);
    if (candidateHash === expectedHash) {
      setPin('');
      onUnlock();
    } else {
      setError('Incorrect device PIN. Try again.');
      setPin('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--m3-surface)] p-6 text-[var(--m3-on-surface)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-heading"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-8 text-center shadow-xl space-y-5"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 id="app-lock-heading" className="font-display text-xl font-bold">
            Katalog Vault Locked
          </h1>
          <p className="mt-1 text-sm text-[var(--m3-on-surface-variant)]">
            Enter your device PIN to access internal inventory photos.
          </p>
        </div>

        <div>
          <label htmlFor="unlock-pin-input" className="sr-only">
            Device PIN
          </label>
          <input
            id="unlock-pin-input"
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="min-h-[52px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 text-center font-mono text-2xl tracking-[0.4em]"
          />
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="min-h-[48px] w-full rounded-2xl bg-[var(--m3-primary)] text-sm font-semibold text-[var(--m3-on-primary)]"
        >
          Unlock Catalogue
        </button>
      </form>
    </div>
  );
};
