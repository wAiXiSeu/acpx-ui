import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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
  toasts: ToastMessage[];
}

interface UIActions {
  toggleSidebar: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

type UIStore = UIState & UIActions;

const initialState: UIState = {
  sidebarCollapsed: false,
  toasts: [],
};

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

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
