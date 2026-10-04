import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeedFilterData } from '@/lib/validators/schemas';
import type { AITheme, Geography, Stage, UserRole } from '@/types';

interface UIState {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

interface FeedState {
  filters: FeedFilterData;
  setFilters: (filters: Partial<FeedFilterData>) => void;
  resetFilters: () => void;
  lastFetch: number | null;
  setLastFetch: (timestamp: number) => void;
}

interface OnboardingState {
  currentStep: number;
  data: Partial<{
    role: UserRole;
    ai_topics: AITheme[];
    geographies: Geography[];
    stages: Stage[];
    follow_funds: string[];
    follow_companies: string[];
  }>;
  setStep: (step: number) => void;
  updateData: (data: Partial<OnboardingState['data']>) => void;
  reset: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileMenuOpen: false,
      theme: 'system',
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ventro-ui' }
  )
);

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      filters: {},
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: {} }),
      lastFetch: null,
      setLastFetch: (timestamp) => set({ lastFetch: timestamp }),
    }),
    { name: 'ventro-feed' }
  )
);

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      data: {},
      setStep: (step) => set({ currentStep: step }),
      updateData: (data) => set((state) => ({ data: { ...state.data, ...data } })),
      reset: () => set({ currentStep: 1, data: {} }),
    }),
    { name: 'ventro-onboarding' }
  )
);
