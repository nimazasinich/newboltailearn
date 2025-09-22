import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  copied: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate a unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // reportError(error, errorInfo, this.state.errorId);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      copied: false,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleCopyError = async () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorReport = `
خطای برنامه - گزارش خطا
========================

شناسه خطا: ${errorId}
زمان: ${new Date().toLocaleString('fa-IR')}
نسخه: ${process.env.REACT_APP_VERSION || 'نامشخص'}
محیط: ${process.env.NODE_ENV}

خطا:
${error?.name}: ${error?.message}

جزئیات:
${error?.stack}

Component Stack:
${errorInfo?.componentStack}

User Agent:
${navigator.userAgent}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorReport);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch (err) {
      console.error('Failed to copy error report:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4" dir="rtl">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                خطایی رخ داده است
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                متأسفانه در اجرای برنامه خطایی رخ داده است. لطفاً دوباره تلاش کنید.
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Error ID for support */}
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  شناسه خطا (برای پشتیبانی)
                </h3>
                <code className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {errorId}
                </code>
              </div>

              {/* Error details in development */}
              {isDevelopment && error && (
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <h3 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    جزئیات خطا (حالت توسعه)
                  </h3>
                  <div className="text-sm text-red-700 dark:text-red-300 space-y-2">
                    <div>
                      <strong>نوع خطا:</strong> {error.name}
                    </div>
                    <div>
                      <strong>پیام:</strong> {error.message}
                    </div>
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium hover:text-red-600 dark:hover:text-red-400">
                          Stack Trace
                        </summary>
                        <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900 p-2 rounded overflow-auto max-h-40">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 ml-2" />
                  تلاش مجدد
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                >
                  <Home className="h-4 w-4 ml-2" />
                  بازگشت به صفحه اصلی
                </Button>

                <Button
                  onClick={this.handleCopyError}
                  variant="outline"
                  className={this.state.copied ? 'text-green-600 border-green-600' : ''}
                >
                  {this.state.copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 ml-2" />
                      کپی شد
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 ml-2" />
                      کپی گزارش خطا
                    </>
                  )}
                </Button>
              </div>

              {/* Help text */}
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
                <p>
                  اگر این خطا مداوم تکرار می‌شود، لطفاً گزارش خطا را کپی کرده و با تیم پشتیبانی تماس بگیرید.
                </p>
                <div className="mt-2 space-x-4 space-x-reverse">
                  <a
                    href="mailto:support@persian-legal-ai.ir"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ایمیل پشتیبانی
                  </a>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <a
                    href="https://t.me/PersianLegalAI"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    تلگرام
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;