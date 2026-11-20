import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(() => {
    try {
      return localStorage.getItem('katalog_sim_offline') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = (next: boolean) => {
    setSimulatedOffline(next);
    try {
      localStorage.setItem('katalog_sim_offline', String(next));
    } catch {
      // ignore storage errors
    }
  };

  return {
    browserOnline,
    simulatedOffline,
    isOnline: browserOnline && !simulatedOffline,
    toggleSimulatedOffline,
  };
}
