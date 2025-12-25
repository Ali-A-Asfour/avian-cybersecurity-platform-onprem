import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Dashboard Layout Component
 * 
 * Implements the responsive grid layout for the Tenant Admin Dashboard
 * following the specified structure with enhanced responsive design:
 * 
 * Mobile (< 768px): Single column stack
 * Tablet (768px - 1279px): 2 columns for middle section  
 * Desktop (≥ 1280px): Full 4-column layout
 * 
 * Enhanced for 1280px minimum viewport width requirement:
 * - Optimized spacing and padding for smaller screens
 * - Improved touch targets for mobile/tablet
 * - Better keyboard navigation support
 * 
 * Row 1: KPI Cards (responsive: 1/2/4 columns)
 * Row 2: Alerts Trend Graph (full width)
 * Row 3: Device Coverage | Ticket Breakdown | Integration Health (responsive)
 * Row 4: Recent Activity Feed (full width)
 */
const DashboardLayoutComponent: React.FC<DashboardLayoutProps> = ({
    children,
    className
}) => {
    return (
        <main
            className={cn(
                // Enhanced responsive container with 1280px minimum support
                "w-full max-w-7xl mx-auto",
                // Responsive padding: tighter on smaller screens, more generous on larger
                "px-3 sm:px-4 lg:px-6 xl:px-8",
                "py-3 sm:py-4 lg:py-6",
                // Responsive spacing between sections
                "space-y-3 sm:space-y-4 lg:space-y-6",
                // Ensure proper overflow handling for narrow viewports
                "overflow-x-hidden"
            )}
            role="main"
            aria-label="Tenant Admin Dashboard"
        >
            <div className={cn(
                // Base layout styles for SOC dark theme
                "bg-neutral-900 text-neutral-100",
                // Enhanced responsive grid layout with better 1280px support
                "grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6",
                // Tablet layout: 2 columns for middle section
                "md:grid-cols-2",
                // Desktop layout: 4 columns with auto-sizing rows (1280px+)
                "xl:grid-cols-4 xl:auto-rows-min",
                // Ensure minimum viewport support and prevent overflow
                "min-w-0 w-full", // Prevent grid overflow and ensure full width
                // Better handling of content at 1280px breakpoint
                "xl:min-w-[1280px]", // Ensure minimum width at xl breakpoint
                className
            )}>
                {children}
            </div>
        </main>
    );
};

// Memoize the layout component to prevent unnecessary re-renders
export const DashboardLayout = memo(DashboardLayoutComponent, (prevProps, nextProps) => {
    return (
        prevProps.className === nextProps.className &&
        prevProps.children === nextProps.children
    );
});