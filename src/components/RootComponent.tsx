import React, { useEffect } from 'react';
import { initializeCapacitor } from '@/lib/capacitor';

export function RootComponent({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeCapacitor();
  }, []);

  return <>{children}</>;
}
