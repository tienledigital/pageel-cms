import React from 'react';
import type { IGitService, GithubRepo } from '../types';
import type { PluginConfig } from '../plugins';
import { SUPPORTED_PLUGINS } from '../plugins/registry';
import { PuzzleIcon } from './icons/PuzzleIcon';

interface PluginsViewProps {
  gitService: IGitService;
  repo: GithubRepo;
  pluginConfig: PluginConfig;
  setPluginConfig: (config: PluginConfig) => void;
}

// @para-doc [#csa-plugins-view-layout]
export const PluginsView: React.FC<PluginsViewProps> = ({
  gitService,
  repo,
  pluginConfig,
  setPluginConfig,
}) => {
  const activeEditor = pluginConfig?.plugins?.editor;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-notion-border pb-4">
        <div>
          <h2 className="text-lg font-semibold text-notion-text">Available Plugins</h2>
          <p className="text-sm text-notion-muted">
            Manage your editor extensions and layout components.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SUPPORTED_PLUGINS.map((plugin) => {
          const isActive = activeEditor === plugin.id;

          return (
            <div
              key={plugin.id}
              className={`border rounded-md p-6 bg-white transition-all shadow-sm flex flex-col justify-between hover:shadow-md ${
                isActive ? 'border-notion-blue bg-blue-50/5' : 'border-notion-border'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-sm ${isActive ? 'bg-blue-100 text-notion-blue' : 'bg-gray-100 text-notion-muted'}`}>
                      <PuzzleIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-notion-text">{plugin.name}</h3>
                      <span className="text-xs text-notion-muted font-mono">v{plugin.version} • By {plugin.author}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-4 text-sm text-notion-muted leading-relaxed">
                  {plugin.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-notion-border flex items-center justify-between">
                <button
                  type="button"
                  className="px-3.5 py-1.5 border border-notion-border hover:bg-notion-hover text-xs font-medium rounded-sm shadow-sm transition-colors text-notion-text"
                >
                  Configure
                </button>
                <button
                  type="button"
                  className={`px-4 py-1.5 text-xs font-medium rounded-sm shadow-sm transition-colors ${
                    isActive
                      ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                      : 'bg-notion-blue hover:bg-blue-600 text-white'
                  }`}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
