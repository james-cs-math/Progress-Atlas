import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TierType = 'euclid' | 'aristotle' | 'plato' | 'socrates';

interface TierContextType {
  currentTier: TierType;
  setCurrentTier: (tier: TierType) => void;
}

const TierContext = createContext<TierContextType | undefined>(undefined);

const VALID_TIERS: TierType[] = ['euclid', 'aristotle', 'plato', 'socrates'];
const STORAGE_KEY = 'atlas_current_tier';

export function TierProvider({ children }: { children: ReactNode }) {
  const [currentTier, setCurrentTierState] = useState<TierType>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TierType;
      if (VALID_TIERS.includes(saved)) return saved;
    } catch {}
    return 'euclid';
  });

  const setCurrentTier = (tier: TierType) => {
    setCurrentTierState(tier);
    try {
      localStorage.setItem(STORAGE_KEY, tier);
      // Notify usage counters to re-read since limits may have changed
      window.dispatchEvent(new Event('atlas_usage_updated'));
    } catch {}
  };

  return (
    <TierContext.Provider value={{ currentTier, setCurrentTier }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  const context = useContext(TierContext);
  if (context === undefined) {
    throw new Error('useTier must be used within a TierProvider');
  }
  return context;
}