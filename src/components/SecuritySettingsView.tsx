import React, { useState } from 'react';
import {
  Check,
  KeyRound,
  Lock,
  LogOut,
  MailCheck,
  Moon,
  Palette,
  Shield,
  Sun,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { MaterialColorSeed } from '../types/inventory';
import { PWAInstallButton } from './PWAInstallButton';

interface SecuritySettingsViewProps {
  user: User | null;
  demoMode: boolean;
  darkMode: boolean;
  colorSeed: MaterialColorSeed;
  hasPinLock: boolean;
  onToggleDarkMode: () => void;
  onChangeColorSeed: (seed: MaterialColorSeed) => void;
  onSetPinLock: (pin: string) => Promise<void>;
  onRemovePinLock: () => void;
  onTriggerLockNow: () => void;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenAuthGate: () => void;
}

const COLOR_SEEDS: { id: MaterialColorSeed; label: string; swatch: string }[] = [
  { id: 'ochre', label: 'Atelier Bronze', swatch: '#825224' },
  { id: 'indigo', label: 'Indigo Dye', swatch: '#3b5392' },
  { id: 'sage', label: 'Pista Sage', swatch: '#2d664f' },
  { id: 'slate', label: 'Studio Slate', swatch: '#395b6e' },
];

export const SecuritySettingsView: React.FC<SecuritySettingsViewProps> = ({
  user,
  demoMode,
  darkMode,
  colorSeed,
  hasPinLock,
  onToggleDarkMode,
  onChangeColorSeed,
  onSetPinLock,
  onRemovePinLock,
  onTriggerLockNow,
  onResendVerification,
  onRefreshVerification,
  onSignOut,
  onOpenAuthGate,
}) => {
  const [pinDraft, setPinDraft] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);
  const [verifyingBusy, setVerifyingBusy] = useState(false);

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSavedMsg(null);
    if (!/^\d{4,6}$/.test(pinDraft)) {
      setPinError('Enter a 4 to 6 digit numeric PIN.');
      return;
    }
    await onSetPinLock(pinDraft);
    setPinDraft('');
    setPinSavedMsg('Device PIN lock enabled (stored as SHA-256 hash).');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Authentication & Identity Protection */}
      <section
        aria-labelledby="auth-session-heading"
        className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]">
              <Shield className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-session-heading" className="font-display text-lg font-bold">
                {user ? user.displayName || 'Authenticated Staff Account' : 'Offline Demo Workspace'}
              </h2>
              <p className="text-sm text-[var(--m3-on-surface-variant)]">
                {user
                  ? `${user.email} · Owner-isolated Firestore encryption & rules active`
                  : 'Running locally in IndexedDB. Sign in with Firebase to enable cloud sync across devices.'}
              </p>
            </div>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[var(--m3-outline-variant)] px-4 text-sm font-semibold text-[var(--m3-on-surface)] hover:bg-[var(--m3-surface-container)] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthGate}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 text-sm font-semibold text-[var(--m3-on-primary)] whitespace-nowrap shrink-0"
            >
              Sign In with Firebase
            </button>
          )}
        </div>

        {user && !user.emailVerified && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <MailCheck className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                    Verify your email to enable cloud writes
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                    Security rules require a verified email before writing to Firestore. Local offline edits remain queued safely.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={verifyingBusy}
                  onClick={async () => {
                    setVerifyingBusy(true);
                    try {
                      await onResendVerification();
                    } finally {
                      setVerifyingBusy(false);
                    }
                  }}
                  className="min-h-[40px] rounded-xl border border-amber-400 px-3 text-xs font-semibold text-amber-950 dark:text-amber-100"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  disabled={verifyingBusy}
                  onClick={async () => {
                    setVerifyingBusy(true);
                    try {
                      await onRefreshVerification();
                    } finally {
                      setVerifyingBusy(false);
                    }
                  }}
                  className="min-h-[40px] rounded-xl bg-amber-700 px-3 text-xs font-semibold text-white"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--m3-outline-variant)] text-xs text-[var(--m3-on-surface-variant)]">
          <div>
            <p className="font-semibold text-[var(--m3-on-surface)]">Access Isolation</p>
            <p className="mt-0.5">Strict per-user Firestore path scoping and PII protection.</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--m3-on-surface)]">Photo Privacy</p>
            <p className="mt-0.5">EXIF GPS and camera metadata stripped during canvas export.</p>
          </div>
          <div>
            <p className="font-semibold text-[var(--m3-on-surface)]">Session Mode</p>
            <p className="mt-0.5">{demoMode ? 'Local Sandbox Vault' : 'Firebase Authenticated'}</p>
          </div>
        </div>
      </section>

      {/* Device App Lock PIN (Web Crypto SHA-256) */}
      <section
        aria-labelledby="device-lock-heading"
        className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--m3-surface-container)] text-[var(--m3-primary)]">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="device-lock-heading" className="font-display text-base font-bold">
                Device Screen Lock PIN
              </h3>
              <p className="text-xs text-[var(--m3-on-surface-variant)]">
                Protect shared warehouse tablets with a local SHA-256 hashed PIN lock.
              </p>
            </div>
          </div>
          {hasPinLock && (
            <button
              type="button"
              onClick={onTriggerLockNow}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[var(--m3-primary-container)] px-4 text-xs font-semibold text-[var(--m3-on-primary-container)] whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Lock Now
            </button>
          )}
        </div>

        <form onSubmit={(e) => void handleSavePin(e)} className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="pin-setup-input" className="sr-only">
            Enter 4 to 6 digit device PIN
          </label>
          <input
            id="pin-setup-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinDraft}
            onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
            placeholder={hasPinLock ? 'Enter new 4–6 digit PIN to update' : 'Set 4–6 digit numeric PIN'}
            className="min-h-[46px] flex-1 rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 font-mono text-sm"
          />
          <button
            type="submit"
            className="min-h-[46px] rounded-2xl bg-[var(--m3-primary)] px-5 text-sm font-semibold text-[var(--m3-on-primary)] whitespace-nowrap"
          >
            {hasPinLock ? 'Update PIN' : 'Enable PIN Lock'}
          </button>
          {hasPinLock && (
            <button
              type="button"
              onClick={() => {
                onRemovePinLock();
                setPinSavedMsg('Device PIN lock removed.');
              }}
              className="min-h-[46px] rounded-2xl border border-[var(--m3-outline-variant)] px-4 text-sm font-semibold text-[var(--m3-on-surface-variant)] whitespace-nowrap"
            >
              Disable
            </button>
          )}
        </form>

        {pinError && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {pinError}
          </p>
        )}
        {pinSavedMsg && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {pinSavedMsg}
          </p>
        )}
      </section>

      {/* Material 3 Expressive Dynamic Color & PWA Installation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          aria-labelledby="appearance-heading"
          className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-[var(--m3-primary)]" aria-hidden="true" />
              <h3 id="appearance-heading" className="font-display text-base font-bold">
                Material 3 Dynamic Color
              </h3>
            </div>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-3.5 text-xs font-semibold"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {COLOR_SEEDS.map((seed) => {
              const active = colorSeed === seed.id;
              return (
                <button
                  key={seed.id}
                  type="button"
                  onClick={() => onChangeColorSeed(seed.id)}
                  aria-pressed={active}
                  className={`flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border px-3.5 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'border-[var(--m3-primary)] bg-[var(--m3-primary-container)] text-[var(--m3-on-primary-container)]'
                      : 'border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-black/15"
                      style={{ backgroundColor: seed.swatch }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{seed.label}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="install-pwa-heading"
          className="rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-5 sm:p-6 flex flex-col justify-between gap-4"
        >
          <div>
            <h3 id="install-pwa-heading" className="font-display text-base font-bold">
              Install Android / Device App
            </h3>
            <p className="mt-1.5 text-sm text-[var(--m3-on-surface-variant)]">
              Add Katalog to your Android home screen or desktop for full-screen standalone navigation and offline service worker caching.
            </p>
          </div>
          <div>
            <PWAInstallButton variant="card" />
          </div>
        </section>
      </div>
    </div>
  );
};
