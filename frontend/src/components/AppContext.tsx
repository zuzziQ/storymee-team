'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type TabType = 'overview' | 'kanban' | 'ai-chat' | 'milestones' | 'attendance' | 'leave' | 'workload' | 'team' | 'config';

interface AppContextProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  return (
    <AppContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
