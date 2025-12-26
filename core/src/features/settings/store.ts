/**
 * Settings Store
 * 
 * Zustand store for application settings with localStorage persistence.
 * Replaces settings state from Dashboard.tsx.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, IGitService } from '../../types';
import { DEFAULT_SETTINGS, SETTINGS_SCHEMA } from './types';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  isSetupComplete: boolean;
}

interface SettingsActions {
  setSettings: (settings: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => void;
  resetSettings: () => void;
  setIsLoading: (loading: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setSaveSuccess: (success: boolean) => void;
  setSetupComplete: (complete: boolean) => void;
  
  // Load settings from localStorage (called on mount)
  loadSettings: (repoId: string) => void;
  
  // Save settings to localStorage and optionally to Git repo
  saveSettings: (repoId: string, gitService?: IGitService) => Promise<void>;
  
  // Validate settings against schema
  validateSettings: (settings: Partial<AppSettings>) => boolean;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * Get storage key for repo-specific settings
 */
const getStorageKey = (key: string, repoId: string, isRepoSpecific: boolean) => {
  return isRepoSpecific ? `${key}_${repoId}` : key;
};

/**
 * Repo-specific setting keys
 */
const REPO_SPECIFIC_KEYS = ['projectType', 'postsPath', 'imagesPath', 'domainUrl'];

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // State
      settings: DEFAULT_SETTINGS,
      isLoading: false,
      isSaving: false,
      saveSuccess: false,
      isSetupComplete: false,

      // Actions
      setSettings: (newSettings) => {
        if (typeof newSettings === 'function') {
          // Support updater function pattern: setSettings(prev => ({ ...prev, key: value }))
          set((state) => ({
            settings: newSettings(state.settings),
          }));
        } else {
          // Support partial update pattern: setSettings({ key: value })
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          }));
        }
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS, isSetupComplete: false });
      },

      setIsLoading: (loading) => set({ isLoading: loading }),
      setIsSaving: (saving) => set({ isSaving: saving }),
      setSaveSuccess: (success) => set({ saveSuccess: success }),
      setSetupComplete: (complete) => set({ isSetupComplete: complete }),

      loadSettings: (repoId) => {
        const loadedSettings: Partial<AppSettings> = {};
        
        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
          const isRepoSpecific = REPO_SPECIFIC_KEYS.includes(key);
          const storageKey = getStorageKey(key, repoId, isRepoSpecific);
          const stored = localStorage.getItem(storageKey);
          
          if (stored !== null) {
            const validator = SETTINGS_SCHEMA[key];
            // Parse value based on type
            let value: unknown = stored;
            if (stored === 'true') value = true;
            else if (stored === 'false') value = false;
            else if (!isNaN(Number(stored)) && stored !== '') value = Number(stored);
            
            if (!validator || validator(value)) {
              (loadedSettings as Record<string, unknown>)[key] = value;
            }
          }
        });

        set((state) => ({
          settings: { ...state.settings, ...loadedSettings },
        }));

        // Check if setup is complete
        const { projectType, postsPath, imagesPath } = get().settings;
        if (projectType && postsPath && imagesPath) {
          set({ isSetupComplete: true });
        }
      },

      saveSettings: async (repoId, gitService) => {
        const { settings } = get();
        set({ isSaving: true, saveSuccess: false });

        try {
          // Save to localStorage
          Object.keys(settings).forEach((key) => {
            const isRepoSpecific = REPO_SPECIFIC_KEYS.includes(key);
            const storageKey = getStorageKey(key, repoId, isRepoSpecific);
            localStorage.setItem(storageKey, String(settings[key as keyof AppSettings]));
          });

          // Optionally save to .pageelrc.json on repo
          if (gitService) {
            try {
              const sha = await (gitService as any).getFileSha('.pageelrc.json');
              if (sha) {
                const configObject = {
                  version: 1,
                  projectType: settings.projectType,
                  postsPath: settings.postsPath,
                  imagesPath: settings.imagesPath,
                  domainUrl: settings.domainUrl,
                  settings: {
                    postFileTypes: settings.postFileTypes,
                    imageFileTypes: settings.imageFileTypes,
                    publishDateSource: settings.publishDateSource,
                    imageCompression: {
                      enabled: settings.imageCompressionEnabled,
                      maxSize: settings.maxImageSize,
                      maxWidth: settings.imageResizeMaxWidth,
                    },
                  },
                  commitMessages: {
                    newPost: settings.newPostCommit,
                    updatePost: settings.updatePostCommit,
                    newImage: settings.newImageCommit,
                    updateImage: settings.updateImageCommit,
                  },
                };
                await gitService.updateFileContent(
                  '.pageelrc.json',
                  JSON.stringify(configObject, null, 2),
                  'chore: update pageel-core config',
                  sha
                );
              }
            } catch (e) {
              console.warn('Could not update .pageelrc.json', e);
            }
          }

          set({ saveSuccess: true });
          setTimeout(() => set({ saveSuccess: false }), 3000);
        } catch (e) {
          console.error('Failed to save settings:', e);
        } finally {
          set({ isSaving: false });
        }
      },

      validateSettings: (settings) => {
        return Object.entries(settings).every(([key, value]) => {
          const validator = SETTINGS_SCHEMA[key];
          return !validator || validator(value);
        });
      },
    }),
    {
      name: 'pageel-settings',
      partialize: (state) => ({ 
        // Only persist these fields
        isSetupComplete: state.isSetupComplete,
      }),
    }
  )
);
