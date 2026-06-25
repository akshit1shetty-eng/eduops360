import { createContext, useContext, useState, type ReactNode } from 'react';

interface LexFilterContextType {
  selectedUniversityId: string | null;
  setSelectedUniversityId: (id: string | null) => void;
}

const LexFilterContext = createContext<LexFilterContextType | undefined>(undefined);

export function LexFilterProvider({ children }: { children: ReactNode }) {
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);

  return (
    <LexFilterContext.Provider value={{ selectedUniversityId, setSelectedUniversityId }}>
      {children}
    </LexFilterContext.Provider>
  );
}

export function useLexFilter() {
  const context = useContext(LexFilterContext);
  if (context === undefined) {
    throw new Error('useLexFilter must be used within a LexFilterProvider');
  }
  return context;
}
