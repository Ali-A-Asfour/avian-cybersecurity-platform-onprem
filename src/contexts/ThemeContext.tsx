'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDarkMode, enforceDarkModeOnly } from '@/lib/theme-enforcement';

type Theme = 'dark'; // Only dark mode supported

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // Handle hydration and enforce dark mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Always enforce dark mode, ignore any saved preferences
      initializeDarkMode();
    }
    // Set mounted after DOM operations
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Continuously enforce dark mode
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    // Always enforce dark mode
    enforceDarkModeOnly();

    // Set up a mutation observer to prevent any light mode activation
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          if (target === document.documentElement || target === document.body) {
            // Re-enforce dark mode if someone tries to change it
            if (!target.classList.contains('dark') || target.classList.contains('light')) {
              enforceDarkModeOnly();
            }
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, [mounted]);

  // Prevent hydration mismatch - always return dark theme
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: 'dark' }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Safe hook that returns default values during SSR - always dark mode
export function useThemeSafe() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return {
      theme: 'dark' as Theme,
    };
  }
  return context;
}