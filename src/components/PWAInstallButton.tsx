import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="text-sm text-[var(--m3-on-surface-variant)]">
          Installed on this device as a standalone app.
        </div>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--m3-on-primary)] transition-transform duration-150 hover:opacity-95 active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Install App
      </button>
    );
  }

  if (isIOS || variant === 'card') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-low)] px-4 py-2 text-sm font-medium text-[var(--m3-on-surface)] transition-colors hover:bg-[var(--m3-surface-container-high)] whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          {isIOS ? 'Install on iOS' : 'Install to Home Screen'}
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[var(--m3-surface-card)] p-6 shadow-2xl border border-[var(--m3-outline-variant)]">
              <div className="flex items-start justify-between gap-4">
                <h3 id="pwa-install-guide-title" className="text-lg font-bold text-[var(--m3-on-surface)]">
                  Install Katalog on Device
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close installation guide"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--m3-on-surface-variant)] hover:bg-[var(--m3-surface-container)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--m3-on-surface-variant)]">
                {isIOS
                  ? 'Tap the Share icon in Safari, then choose Add to Home Screen for full-screen offline inventory access.'
                  : 'Open your browser menu (three dots) on Android Chrome or desktop Chromium and choose Install App or Add to Home Screen.'}
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-2xl bg-[var(--m3-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--m3-on-primary)]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
