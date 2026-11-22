import { useEffect, useState } from 'react';
import { isOnline, onOutboxChange, pending } from '../api/outbox';

export function useConnectivity() {
  const [online, setOnline] = useState(isOnline());
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    const update = () => {
      setOnline(isOnline());
      pending().then((p) => setQueued(p.length)).catch(() => {});
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const off = onOutboxChange(update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      off();
    };
  }, []);
  return { online, queued };
}
