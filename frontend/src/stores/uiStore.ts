import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WsPermissionParams } from '../types/websocket';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  sidebarCollapsed: boolean;
  activeModal: 'permission' | 'settings' | null;
  permissionParams: WsPermissionParams | null;
  toasts: ToastMessage[];
}

interface UIActions {
  toggleSidebar: () => void;
  showModal: (modal: 'permission' | 'settings') => void;
  showPermissionModal: (params: WsPermissionParams) => void;
  closeModal: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  sidebarCollapsed: false,
  activeModal: null,
  permissionParams: null,
  toasts: [],
};

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    showModal: (activeModal) => set({ activeModal }),

    showPermissionModal: (permissionParams) => set({ activeModal: 'permission', permissionParams }),

    closeModal: () => set({ activeModal: null, permissionParams: null }),

    addToast: (message, type) =>
      set((state) => ({
        toasts: [
          ...state.toasts,
          { id: generateId(), message, type },
        ],
      })),

    removeToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      })),
  }))
);