import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, options?: {
    description?: string;
    duration?: number;
    action?: Toast['action'];
  }) => void;
  removeToast: (id: number) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ 
  children, 
  maxToasts = 5,
  position = 'bottom-right'
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    options?: {
      description?: string;
      duration?: number;
      action?: Toast['action'];
    }
  ) => {
    const id = Date.now() + Math.random();
    const duration = options?.duration ?? (type === 'error' ? 7000 : 5000);
    
    const newToast: Toast = { 
      id, 
      message, 
      type, 
      description: options?.description,
      duration,
      action: options?.action
    };
    
    setToasts(prev => {
      const updated = [newToast, ...prev].slice(0, maxToasts);
      return updated;
    });
    
    // Auto remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
      }, duration);
    }
  }, [maxToasts]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 -translate-x-1/2';
      default:
        return 'bottom-4 right-4';
    }
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, clearAllToasts }}>
      {children}
      
      {/* Toast Container */}
      <div 
        className={cn(
          'fixed z-50 space-y-2 w-full max-w-sm',
          getPositionClasses()
        )}
        dir="rtl"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: number) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 150);
  };

  const getToastStyles = () => {
    const baseStyles = "flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all duration-300 transform";
    
    switch (toast.type) {
      case 'success':
        return cn(baseStyles, 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200');
      case 'error':
        return cn(baseStyles, 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200');
      case 'warning':
        return cn(baseStyles, 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200');
      default:
        return cn(baseStyles, 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200');
    }
  };

  const getIcon = () => {
    const iconClass = "h-5 w-5 flex-shrink-0 mt-0.5";
    
    switch (toast.type) {
      case 'success':
        return <CheckCircle className={cn(iconClass, "text-green-600 dark:text-green-400")} />;
      case 'error':
        return <XCircle className={cn(iconClass, "text-red-600 dark:text-red-400")} />;
      case 'warning':
        return <AlertTriangle className={cn(iconClass, "text-yellow-600 dark:text-yellow-400")} />;
      default:
        return <Info className={cn(iconClass, "text-blue-600 dark:text-blue-400")} />;
    }
  };

  return (
    <div
      className={cn(
        getToastStyles(),
        isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        isExiting && '-translate-x-full opacity-0'
      )}
    >
      {getIcon()}
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-5">
          {toast.message}
        </p>
        
        {toast.description && (
          <p className="text-sm opacity-90 mt-1 leading-5">
            {toast.description}
          </p>
        )}
        
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm font-medium underline mt-2 hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1 rounded-md hover:bg-black hover:bg-opacity-10 transition-colors"
        aria-label="بستن پیام"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Convenience hooks for different toast types
export const useSuccessToast = () => {
  const { showToast } = useToast();
  return useCallback((message: string, options?: Parameters<typeof showToast>[2]) => {
    showToast(message, 'success', options);
  }, [showToast]);
};

export const useErrorToast = () => {
  const { showToast } = useToast();
  return useCallback((message: string, options?: Parameters<typeof showToast>[2]) => {
    showToast(message, 'error', options);
  }, [showToast]);
};

export const useWarningToast = () => {
  const { showToast } = useToast();
  return useCallback((message: string, options?: Parameters<typeof showToast>[2]) => {
    showToast(message, 'warning', options);
  }, [showToast]);
};

export const useInfoToast = () => {
  const { showToast } = useToast();
  return useCallback((message: string, options?: Parameters<typeof showToast>[2]) => {
    showToast(message, 'info', options);
  }, [showToast]);
};