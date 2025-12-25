'use client';

import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (column: string) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onSort,
  sortBy,
  sortOrder,
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };

  const getSortDirection = (column: Column<T>) => {
    if (sortBy === column.key) {
      return sortOrder;
    }
    return null;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              sortable={column.sortable}
              sortDirection={getSortDirection(column)}
              onSort={() => handleSort(column)}
              className={column.sortable ? 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800' : ''}
            >
              <div className="flex items-center space-x-1">
                <span>{column.label}</span>
                {column.sortable && (
                  <div className="flex flex-col">
                    <svg
                      className={`w-3 h-3 ${
                        getSortDirection(column) === 'asc'
                          ? 'text-neutral-900 dark:text-neutral-100'
                          : 'text-neutral-400 dark:text-neutral-600'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    <svg
                      className={`w-3 h-3 -mt-1 ${
                        getSortDirection(column) === 'desc'
                          ? 'text-neutral-900 dark:text-neutral-100'
                          : 'text-neutral-400 dark:text-neutral-600'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              No data available
            </TableCell>
          </TableRow>
        ) : (
          data.map((item, index) => (
            <TableRow key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
              {columns.map((column) => (
                <TableCell key={column.key}>
                  {column.render ? column.render(item) : item[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}