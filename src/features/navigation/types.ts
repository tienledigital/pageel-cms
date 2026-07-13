/**
 * Navigation Feature Types
 */

export type ViewType = 'dashboard' | 'workflows' | 'images' | 'template' | 'backup' | 'settings' | 'plugins';

export interface NavigationState {
  currentView: ViewType;
  history: ViewType[];
}
