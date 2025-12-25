'use client';

import React, { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectContextType {
    value: string;
    onValueChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

interface SelectProps {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
    const [open, setOpen] = useState(false);

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
            <div className="relative">
                {children}
            </div>
        </SelectContext.Provider>
    );
}

interface SelectTriggerProps {
    children: React.ReactNode;
    className?: string;
}

export function SelectTrigger({ children, className }: SelectTriggerProps) {
    const context = useContext(SelectContext);
    if (!context) {
        throw new Error('SelectTrigger must be used within a Select component');
    }

    const { open, setOpen } = context;

    return (
        <button
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            onClick={() => setOpen(!open)}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    );
}

interface SelectValueProps {
    placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
    const context = useContext(SelectContext);
    if (!context) {
        throw new Error('SelectValue must be used within a Select component');
    }

    const { value } = context;

    return (
        <span className={cn(!value && 'text-gray-500')}>
            {value || placeholder}
        </span>
    );
}

interface SelectContentProps {
    children: React.ReactNode;
    className?: string;
}

export function SelectContent({ children, className }: SelectContentProps) {
    const context = useContext(SelectContext);
    if (!context) {
        throw new Error('SelectContent must be used within a Select component');
    }

    const { open, setOpen } = context;

    if (!open) {
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
            />
            {/* Content */}
            <div
                className={cn(
                    'absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-base shadow-lg focus:outline-none sm:text-sm',
                    className
                )}
            >
                {children}
            </div>
        </>
    );
}

interface SelectItemProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

export function SelectItem({ value, children, className }: SelectItemProps) {
    const context = useContext(SelectContext);
    if (!context) {
        throw new Error('SelectItem must be used within a Select component');
    }

    const { value: selectedValue, onValueChange, setOpen } = context;
    const isSelected = selectedValue === value;

    return (
        <button
            className={cn(
                'relative w-full cursor-pointer select-none py-2 pl-3 pr-9 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                isSelected && 'bg-gray-100 font-medium',
                className
            )}
            onClick={() => {
                onValueChange(value);
                setOpen(false);
            }}
        >
            {children}
        </button>
    );
}