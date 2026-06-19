import { create } from 'zustand';

// Define types for customer UI state
export type FilterType = string; // Dynamic service types from database ('all' or service name)
export type SortOrder = 'newest' | 'oldest';

interface CustomerUIState {
    filterType: FilterType;
    sortOrder: SortOrder;
    showFilters: boolean;
    setFilterType: (filter: FilterType) => void;
    setSortOrder: (order: SortOrder) => void;
    toggleFilters: () => void;
}

// Define types for mistri UI state
interface MistriUIState {
    isMistriPanelOpen: boolean;
    toggleMistriPanel: () => void;
}

// Combine both UI states
export const useUIStore = create<CustomerUIState & MistriUIState>((set) => ({
    // Customer defaults
    filterType: 'all',
    sortOrder: 'newest',
    showFilters: false,
    setFilterType: (filterType) => set({ filterType }),
    setSortOrder: (sortOrder) => set({ sortOrder }),
    toggleFilters: () => set((state) => ({ showFilters: !state.showFilters })),

    // Mistri defaults
    isMistriPanelOpen: false,
    toggleMistriPanel: () => set((state) => ({ isMistriPanelOpen: !state.isMistriPanelOpen })),
}));
