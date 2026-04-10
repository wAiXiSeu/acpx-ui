import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      activeModal: null,
      permissionParams: null,
      toasts: [],
    });
  });

  it('should initialize with default state', () => {
    const state = useUIStore.getState();
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.activeModal).toBeNull();
    expect(state.permissionParams).toBeNull();
    expect(state.toasts).toEqual([]);
  });

  it('should toggle sidebar', () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should show modal', () => {
    useUIStore.getState().showModal('permission');
    expect(useUIStore.getState().activeModal).toBe('permission');
    useUIStore.getState().showModal('settings');
    expect(useUIStore.getState().activeModal).toBe('settings');
  });

  it('should show permission modal', () => {
    const params = {
      requestId: 'req-1',
      sessionId: 'session-1',
      toolName: 'Read',
      input: { path: '/tmp/test.txt' },
      options: [],
    } as any;
    useUIStore.getState().showPermissionModal(params);
    const state = useUIStore.getState();
    expect(state.activeModal).toBe('permission');
    expect(state.permissionParams).toBe(params);
  });

  it('should close modal', () => {
    useUIStore.getState().showModal('settings');
    useUIStore.getState().closeModal();
    const state = useUIStore.getState();
    expect(state.activeModal).toBeNull();
    expect(state.permissionParams).toBeNull();
  });

  it('should add toast', () => {
    useUIStore.getState().addToast('Test message', 'info');
    expect(useUIStore.getState().toasts).toHaveLength(1);
    expect(useUIStore.getState().toasts[0].message).toBe('Test message');
    expect(useUIStore.getState().toasts[0].type).toBe('info');
  });

  it('should remove toast', () => {
    useUIStore.getState().addToast('Message 1', 'info');
    useUIStore.getState().addToast('Message 2', 'error');
    const toastId = useUIStore.getState().toasts[0].id;
    useUIStore.getState().removeToast(toastId);
    expect(useUIStore.getState().toasts).toHaveLength(1);
    expect(useUIStore.getState().toasts[0].message).toBe('Message 2');
  });
});
