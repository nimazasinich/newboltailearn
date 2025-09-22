import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface Column<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string;
  itemsPerPage?: number;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showPagination?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
}

function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error,
  itemsPerPage = 10,
  onRowClick,
  className = '',
  emptyMessage = 'داده‌ای یافت نشد',
  searchPlaceholder = 'جستجو...',
  showSearch = true,
  showPagination = true,
  striped = true,
  hoverable = true,
  compact = false,
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Search filter
    if (searchTerm && showSearch) {
      const searchableColumns = columns.filter(col => col.searchable !== false);
      filtered = data.filter((row) =>
        searchableColumns.some((col) =>
          String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Sort
    if (sortField) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        // Handle different data types
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal, 'fa')
            : bVal.localeCompare(aVal, 'fa');
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Fallback to string comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortDirection === 'asc' 
          ? aStr.localeCompare(bStr, 'fa')
          : bStr.localeCompare(aStr, 'fa');
      });
    }

    return filtered;
  }, [data, columns, searchTerm, sortField, sortDirection, showSearch]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = showPagination 
    ? processedData.slice(startIndex, startIndex + itemsPerPage)
    : processedData;

  // Reset pagination when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSort = (field: keyof T) => {
    const column = columns.find(col => col.key === field);
    if (!column?.sortable) return;

    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof T) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4" />
      : <ChevronDown className="h-4 w-4" />;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {showSearch && (
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        )}
        <div className="space-y-2">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="text-red-600 dark:text-red-400 mb-2">خطا در بارگذاری داده‌ها</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{error}</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      {/* Search */}
      {showSearch && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          {showPagination && processedData.length > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              نمایش {startIndex + 1}-{Math.min(startIndex + itemsPerPage, processedData.length)} از {processedData.length} مورد
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full bg-white dark:bg-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300',
                    column.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none',
                    column.align === 'center' && 'text-center',
                    column.align === 'left' && 'text-left',
                    'text-right', // Default RTL alignment
                    compact && 'px-2 py-2',
                    column.className
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className={cn(
                    'flex items-center gap-2',
                    column.align === 'center' && 'justify-center',
                    column.align === 'left' && 'justify-start',
                    'justify-end' // Default RTL alignment
                  )}>
                    <span>{column.title}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        {getSortIcon(column.key) || (
                          <div className="text-gray-400">
                            <ChevronUp className="h-3 w-3" />
                            <ChevronDown className="h-3 w-3 -mt-1" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    'border-t border-gray-100 dark:border-gray-700',
                    striped && index % 2 === 0 && 'bg-gray-50/50 dark:bg-gray-800/50',
                    hoverable && 'hover:bg-gray-50 dark:hover:bg-gray-800',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row, startIndex + index)}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={cn(
                        'px-4 py-3 text-sm text-gray-900 dark:text-gray-100',
                        column.align === 'center' && 'text-center',
                        column.align === 'left' && 'text-left',
                        'text-right', // Default RTL alignment
                        compact && 'px-2 py-2',
                        column.className
                      )}
                    >
                      {column.render 
                        ? column.render(row[column.key], row, startIndex + index)
                        : String(row[column.key] || '')
                      }
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td 
                  colSpan={columns.length} 
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
              قبلی
            </button>
            
            <div className="flex items-center gap-1">
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      'px-3 py-2 text-sm rounded-md',
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {pageNum.toLocaleString('fa-IR')}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              بعدی
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            صفحه {currentPage.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;