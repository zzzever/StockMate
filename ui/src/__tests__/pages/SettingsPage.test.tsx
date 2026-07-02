import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '@/pages/SettingsPage';
import { useDeepSeekConfig } from '@/hooks/useTauriQuery';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@/hooks/useTauriQuery', () => ({
  useDeepSeekConfig: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('SettingsPage', () => {
  const invokeMock = invoke as ReturnType<typeof vi.fn>;

  afterEach(() => {
    invokeMock.mockClear();
  });

  it('renders settings page with DeepSeek config', () => {
    vi.mocked(useDeepSeekConfig).mockReturnValue({ data: { has_key: false, model: 'deepseek-v4-pro' }, isLoading: false, refetch: vi.fn() } as any);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    expect(screen.getByText('设置')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek AI 配置')).toBeInTheDocument();
    expect(screen.getByText('未配置')).toBeInTheDocument();
  });

  it('shows configured state when API key exists', () => {
    vi.mocked(useDeepSeekConfig).mockReturnValue({ data: { has_key: true, model: 'deepseek-v4-pro' }, isLoading: false, refetch: vi.fn() } as any);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    expect(screen.getByText('已配置')).toBeInTheDocument();
  });

  it('allows toggling API key visibility', () => {
    vi.mocked(useDeepSeekConfig).mockReturnValue({ data: { has_key: false, model: 'deepseek-v4-pro' }, isLoading: false, refetch: vi.fn() } as any);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('请输入 DeepSeek API Key') as HTMLInputElement;
    expect(input.type).toBe('password');
    // Toggle visibility button
    const toggleBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'));
    if (toggleBtn) fireEvent.click(toggleBtn);
  });

  it('triggers save configuration', async () => {
    const refetch = vi.fn();
    vi.mocked(useDeepSeekConfig).mockReturnValue({ data: { has_key: false, model: 'deepseek-v4-pro' }, isLoading: false, refetch } as any);
    invokeMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('请输入 DeepSeek API Key') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test-api-key' } });
    const saveBtn = screen.getByText('保存配置');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('save_deepseek_config', { apiKey: 'test-api-key', model: 'deepseek-v4-pro' });
    });
  });

  it('triggers connection test', async () => {
    const refetch = vi.fn();
    vi.mocked(useDeepSeekConfig).mockReturnValue({ data: { has_key: true, model: 'deepseek-v4-pro' }, isLoading: false, refetch } as any);
    invokeMock.mockResolvedValue({ success: true, message: '连接成功' });

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );
    const testBtn = screen.getByText('连接测试');
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('test_deepseek_connection');
    });
  });
});
