import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { evaluatePasswordStrength } from '../utils/inventoryLogic';
import { ResilientImage } from './ResilientImage';
import { SEED_MEDIA_SAMPLES } from '../data/seedInventory';

interface AuthGateProps {
  onGoogleSignIn: () => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailRegister: (name: string, email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  onEnterDemoWorkspace: () => void;
  authError: string | null;
  busy: boolean;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  onGoogleSignIn,
  onEmailSignIn,
  onEmailRegister,
  onPasswordReset,
  onEnterDemoWorkspace,
  authError,
  busy,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Enter a valid work email address.');
      return;
    }

    if (mode === 'signup') {
      if (displayName.trim().length < 2) {
        setFormError('Enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 8) {
        setFormError('Choose a password with at least 8 characters.');
        return;
      }
      await onEmailRegister(displayName.trim(), trimmedEmail, password);
    } else {
      if (password.length < 6) {
        setFormError('Enter your account password.');
        return;
      }
      await onEmailSignIn(trimmedEmail, password);
    }
  };

  const handleForgotPassword = async () => {
    setFormError(null);
    setResetNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Enter your work email address above first, then select Forgot password.');
      return;
    }
    setResetBusy(true);
    try {
      await onPasswordReset(trimmedEmail);
      // Neutral confirmation message avoids account enumeration while guiding legitimate users
      setResetNotice(
        `If an account exists for ${trimmedEmail}, a password reset link has been sent. Check your inbox and spam folder.`
      );
    } catch {
      setFormError('Could not send password reset email right now. Check your connection and try again.');
    } finally {
      setResetBusy(false);
    }
  };

  const displayError = formError || authError;

  return (
    <div className="min-h-screen bg-[var(--m3-surface)] text-[var(--m3-on-surface)] flex flex-col lg:flex-row">
      {/* Left Visual Showcase Column on Desktop */}
      <section
        aria-label="Katalog workspace preview"
        className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col justify-between bg-[var(--m3-surface-container-low)] p-12 border-r border-[var(--m3-outline-variant)]"
      >
        <div className="flex items-center gap-3">
          <img
            src="/icon.svg"
            alt=""
            className="h-10 w-10 rounded-2xl"
          />
          <span className="font-display text-2xl font-bold tracking-tight">Katalog</span>
        </div>

        <div className="my-auto max-w-xl space-y-8 py-8">
          <div className="space-y-4">
            <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight leading-[1.12] text-[var(--m3-on-surface)]">
              Salwar Kameez designs, Karigars, and size pricing in one place.
            </h1>
            <p className="text-base leading-relaxed text-[var(--m3-on-surface-variant)] max-w-lg">
              Photograph every suit, track per-size stock and distinct INR rates, remember which Karigar handled cutting, katha, dyeing, or block printing, and keep fabric & colour notes offline-ready.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {SEED_MEDIA_SAMPLES.slice(0, 3).map((sample) => (
              <div
                key={sample.path}
                className="overflow-hidden rounded-3xl bg-[var(--m3-surface-card)] border border-[var(--m3-outline-variant)]"
              >
                <ResilientImage
                  src={sample.path}
                  alt={sample.label}
                  aspectClassName="aspect-[4/3]"
                  priority
                />
                <div className="px-3.5 py-2.5 text-xs font-medium text-[var(--m3-on-surface-variant)] truncate">
                  {sample.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--m3-on-surface-variant)]">
          <ShieldCheck className="h-4 w-4 text-[var(--m3-primary)] shrink-0" aria-hidden="true" />
          <span>Owner-isolated Firestore security rules · Local IndexedDB cache · Built-in EXIF-stripped photo editor</span>
        </div>
      </section>

      {/* Right Authentication Form Column */}
      <main className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3 lg:hidden mb-8">
            <img src="/icon.svg" alt="" className="h-10 w-10 rounded-2xl" />
            <span className="font-display text-2xl font-bold tracking-tight">Katalog</span>
          </div>

          <div className="mb-7">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {mode === 'signin' ? 'Sign in to workspace' : 'Create staff account'}
            </h2>
            <p className="mt-2 text-sm text-[var(--m3-on-surface-variant)]">
              Authenticate with Google or email & password to protect inventory records and sync across devices.
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-[var(--m3-surface-container)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => {
                setMode('signin');
                setFormError(null);
              }}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'signin'
                  ? 'bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] shadow-xs'
                  : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup');
                setFormError(null);
              }}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-[var(--m3-surface-card)] text-[var(--m3-on-surface)] shadow-xs'
                  : 'text-[var(--m3-on-surface-variant)] hover:text-[var(--m3-on-surface)]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Google Sign-In Primary Option */}
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGoogleSignIn()}
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] px-5 py-3 text-sm font-semibold text-[var(--m3-on-surface)] transition-colors hover:bg-[var(--m3-surface-container-low)] disabled:opacity-60"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.29A7.18 7.18 0 0 1 4.9 12c0-.79.14-1.56.38-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.95 6.72-4.95z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-[var(--m3-on-surface-variant)]">
            <div className="h-px flex-1 bg-[var(--m3-outline-variant)]" />
            <span>or use work email</span>
            <div className="h-px flex-1 bg-[var(--m3-outline-variant)]" />
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jordan Alvarez"
                    className="min-h-[48px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-10 pr-4 text-sm text-[var(--m3-on-surface)] placeholder:text-[var(--m3-outline)]"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="min-h-[48px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-10 pr-4 text-sm text-[var(--m3-on-surface)] placeholder:text-[var(--m3-outline)]"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="auth-password" className="block text-sm font-medium">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    disabled={busy || resetBusy}
                    onClick={() => void handleForgotPassword()}
                    className="text-xs font-semibold text-[var(--m3-primary)] hover:underline disabled:opacity-50"
                  >
                    {resetBusy ? 'Sending reset link...' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="min-h-[48px] w-full rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] pl-10 pr-12 text-sm text-[var(--m3-on-surface)] placeholder:text-[var(--m3-outline)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--m3-on-surface-variant)]">
                  <div className="flex gap-1.5 flex-1 max-w-[180px]">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full ${
                          strength.score >= level
                            ? 'bg-[var(--m3-primary)]'
                            : 'bg-[var(--m3-surface-container-high)]'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-medium">{strength.label}</span>
                </div>
              )}
            </div>

            {resetNotice && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                {resetNotice}
              </div>
            )}

            {displayError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
              >
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 py-3 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? 'Authenticating...' : mode === 'signin' ? 'Sign In with Email' : 'Create Staff Account'}
            </button>
          </form>

          <div className="mt-6 rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--m3-on-surface)]">Offline Evaluation Mode</p>
                <p className="text-xs text-[var(--m3-on-surface-variant)]">
                  Explore the catalogue, photo editor, and local sync queue without signing in.
                </p>
              </div>
              <button
                type="button"
                onClick={onEnterDemoWorkspace}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[var(--m3-primary-container)] px-4 py-2 text-sm font-semibold text-[var(--m3-on-primary-container)] hover:opacity-90 whitespace-nowrap shrink-0"
              >
                Open Demo Workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
