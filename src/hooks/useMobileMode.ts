import { useEffect, useState } from 'react';

export function useMobileMode() {
  const [small, setSmall] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setSmall(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const mode = localStorage.getItem('login_device_mode');
  return mode === 'mobile' || (mode !== 'desktop' && small);
}
