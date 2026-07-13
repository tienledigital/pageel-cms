import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginsView } from '../src/components/PluginsView';

// Mock global fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('react', async () => {
  const actual = await vi.importActual('react') as any;
  return {
    ...actual,
    useState: (init: any) => [init, vi.fn()],
  };
});

describe('PluginsView Integration Unit Tests', () => {
  const mockGitService = {} as any;
  const mockRepo = {} as any;
  const mockPluginConfig = {
    plugins: {
      enabled: true,
      editor: '@pageel/plugin-mdx',
      settings: { fontSize: 14 }
    }
  };
  const mockSetPluginConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  it('should render correct list of supported plugins', () => {
    const result: any = PluginsView({
      gitService: mockGitService,
      repo: mockRepo,
      pluginConfig: mockPluginConfig,
      setPluginConfig: mockSetPluginConfig
    });

    // Check that we render the grid layout
    const gridDiv = result.props.children[2];
    expect(gridDiv.props.className).toContain('grid');
    expect(gridDiv.props.children).toHaveLength(2); // We have 2 supported plugins in registry
  });

  it('should display correct active and inactive states', () => {
    const result: any = PluginsView({
      gitService: mockGitService,
      repo: mockRepo,
      pluginConfig: mockPluginConfig,
      setPluginConfig: mockSetPluginConfig
    });

    const gridDiv = result.props.children[2];
    const firstPluginCard = gridDiv.props.children[0]; // MDX Editor
    const secondPluginCard = gridDiv.props.children[1]; // EasyMDE

    // MDX should be marked Active
    const mdxBadge = firstPluginCard.props.children[0].props.children[0].props.children[1];
    expect(mdxBadge.props.children).toBe('Active');

    // EasyMDE should be marked Inactive
    const easymdeBadge = secondPluginCard.props.children[0].props.children[0].props.children[1];
    expect(easymdeBadge.props.children).toBe('Inactive');
  });
});
