import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlotRenderer } from '../src/plugins/SlotRenderer';
import { usePluginConfig } from '../src/plugins/PluginContext';
import { resolveSlotComponent } from '../src/plugins/registry';

vi.mock('../src/plugins/PluginContext', () => ({
  usePluginConfig: vi.fn(),
}));

vi.mock('../src/plugins/registry', () => ({
  resolveSlotComponent: vi.fn(),
}));

describe('Plugins Logic and SlotRenderer Bypass TDD Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render fallback if plugins are disabled globally (enabled === false)', () => {
    // Mock plugin config showing system is disabled
    vi.mocked(usePluginConfig).mockReturnValue({
      plugins: { enabled: false, editor: '@pageel/plugin-mdx' }
    });
    
    // Mock registry finding the editor component
    const MockEditor = () => 'MockEditorComponent';
    vi.mocked(resolveSlotComponent).mockReturnValue(MockEditor);

    const result = SlotRenderer({
      slot: 'editor',
      pluginName: '@pageel/plugin-mdx',
      fallback: 'fallback-textarea',
      props: {}
    });

    // Expect fallback content to be rendered since enabled is false
    expect(result.props.children).toBe('fallback-textarea');
  });

  it('should render plugin component if plugins are enabled globally (enabled === true)', () => {
    vi.mocked(usePluginConfig).mockReturnValue({
      plugins: { enabled: true, editor: '@pageel/plugin-mdx' }
    });

    const MockEditor = () => 'MockEditorComponent';
    vi.mocked(resolveSlotComponent).mockReturnValue(MockEditor);

    const result = SlotRenderer({
      slot: 'editor',
      pluginName: '@pageel/plugin-mdx',
      fallback: 'fallback-textarea',
      props: {}
    });

    // When active, it returns PluginErrorBoundary -> Suspense -> MockEditor
    // We expect it to not render fallback directly
    expect(result.props.children).not.toBe('fallback-textarea');
  });
});
