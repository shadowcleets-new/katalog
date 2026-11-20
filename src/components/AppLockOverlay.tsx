import React, { useState } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { hashDevicePin } from '../utils/offlineDb';

interface AppLockOverlayProps {
  expectedHash: string;
  onUnlock: () => void;
  onForgotPinReset: () => Promise<void>;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({
  expectedHash,
  onUnlock,
  onForgotPinReset,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  const handleConfirmEmergencyReset = async () => {
    setResetting(true);
    try {
      await onForgotPinReset();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--m3-surface)] p-6 text-[var(--m3-on-surface)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-heading"
    >
      <div className="w-full max-w-sm rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-8 text-center shadow-xl space-y-5">
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

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
            disabled={resetting}
            className="min-h-[48px] w-full rounded-2xl bg-[var(--m3-primary)] text-sm font-semibold text-[var(--m3-on-primary)] disabled:opacity-50"
          >
            Unlock Catalogue
          </button>
        </form>

        <div className="border-t border-[var(--m3-outline-variant)] pt-4">
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="text-xs font-semibold text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-primary)] underline-offset-2 hover:underline"
            >
              Forgot PIN? Sign out &amp; reset lock
            </button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-left dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                For device security, resetting a forgotten PIN signs you out and wipes locally cached data on this device. Cloud-synced designs reload when you sign back in.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => setConfirmingReset(false)}
                  className="min-h-[38px] rounded-xl px-3 text-xs font-semibold text-amber-950 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={() => void handleConfirmEmergencyReset()}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  {resetting ? 'Wiping...' : 'Sign Out & Wipe'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

