/**
 * App Store
 * 
 * Zustand store for general app state (navigation, UI).
 * Replaces activeView, sidebar state from Dashboard.tsx.
 */

import { create } from 'zustand';
import { ViewType } from '../navigation/types';

const VALID_VIEWS: ViewType[] = ['dashboard', 'workflows', 'images', 'template', 'backup', 'settings'];

interface AppState {
  activeView: ViewType;
  isSidebarOpen: boolean;
  isScanning: boolean;
  repoStats: {
    postCount: number | null;
    imageCount: number | null;
  };
}

interface AppActions {
  setView: (view: ViewType) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setScanning: (scanning: boolean) => void;
  setRepoStats: (stats: { postCount: number | null; imageCount: number | null }) => void;
}

export type AppStore = AppState & AppActions;

/**
 * Get initial view from URL
 */
const getInitialView = (): ViewType => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ViewType | null;
    if (view && VALID_VIEWS.includes(view)) {
      return view;
    }
  }
  return 'dashboard';
};

export const useAppStore = create<AppStore>()((set, get) => ({
  // State
  activeView: getInitialView(),
  isSidebarOpen: false,
  isScanning: true,
  repoStats: { postCount: null, imageCount: null },

  // Actions
  setView: (view) => {
    set({ activeView: view });
    
    // Sync to URL
    if (typeof window !== 'undefined' && window.location.protocol !== 'blob:') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', view);
        window.history.pushState({}, '', url.toString());
      } catch (e) {
        console.warn('URL Sync disabled due to environment restrictions.');
      }
    }
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setRepoStats: (stats) => set({ repoStats: stats }),
}));

// Set up popstate listener for browser back/forward
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as ViewType | null;
    if (view && VALID_VIEWS.includes(view)) {
      useAppStore.getState().setView(view);
    } else {
      useAppStore.getState().setView('dashboard');
    }
  });
}
