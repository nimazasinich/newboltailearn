import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto remove toast after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-3 max-w-sm mx-auto pointer-events-none">
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
          index={index}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  index: number;
}

function ToastItem({ toast, onRemove, index }: ToastItemProps) {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  };

  const iconColors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`
        relative p-4 rounded-lg border shadow-lg backdrop-blur-sm pointer-events-auto
        transform transition-all duration-300 ease-out
        animate-slide-in-down
        ${colors[toast.type]}
      `}
      style={{
        animationDelay: `${index * 100}ms`,
        transform: `translateY(${index * 4}px)`,
      }}
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColors[toast.type]}`} />
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{toast.title}</h4>
          {toast.message && (
            <p className="mt-1 text-sm opacity-90">{toast.message}</p>
          )}
          
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium underline hover:no-underline transition-all duration-200"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black hover:bg-opacity-10 dark:hover:bg-white dark:hover:bg-opacity-10 transition-colors duration-200"
          aria-label="بستن اعلان"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar for timed toasts */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-10 dark:bg-white dark:bg-opacity-10 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-current opacity-30 transition-all ease-linear"
            style={{
              width: '100%',
              animation: `shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// Toast helper functions
export const toast = {
  success: (title: string, message?: string, options?: Partial<Toast>) => {
    const { addToast } = useToast();
    return addToast({ type: 'success', title, message, ...options });
  },
  
  error: (title: string, message?: string, options?: Partial<Toast>) => {
    const { addToast } = useToast();
    return addToast({ type: 'error', title, message, ...options });
  },
  
  warning: (title: string, message?: string, options?: Partial<Toast>) => {
    const { addToast } = useToast();
    return addToast({ type: 'warning', title, message, ...options });
  },
  
  info: (title: string, message?: string, options?: Partial<Toast>) => {
    const { addToast } = useToast();
    return addToast({ type: 'info', title, message, ...options });
  },
};

// Add CSS for the shrink animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
`;
document.head.appendChild(style);