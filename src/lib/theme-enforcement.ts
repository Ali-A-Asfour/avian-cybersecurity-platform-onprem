/**
 * Theme Enforcement Utility
 * 
 * This utility enforces dark mode only for the AVIAN cybersecurity platform.
 * It removes all light mode support and ignores system preferences.
 * 
 * Requirements: 3.1, 3.3
 */

export const THEME_CONFIG = {
  theme: 'dark' as const,
  ignoreSystemPreference: true,
  ignoreUserPreference: true,
  cssClass: 'dark',
} as const;

/**
 * Enforces dark mode only by removing light theme classes and setting dark mode
 */
export const enforceDarkModeOnly = () => {
  // Only run in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Remove any existing light theme classes
  document.documentElement.classList.remove('light');

  // Always add dark class
  document.documentElement.classList.add('dark');

  // Clean up any theme-related localStorage entries
  localStorage.removeItem('avian-theme-preference');
  localStorage.removeItem('theme');
  localStorage.removeItem('color-scheme');
  localStorage.removeItem('avian-theme');
  localStorage.removeItem('next-theme');
  localStorage.removeItem('theme-preference');
  localStorage.removeItem('ui-theme');
  localStorage.removeItem('app-theme');
  localStorage.removeItem('user-theme');
  localStorage.removeItem('preferred-theme');

  // Set flag indicating dark mode only
  localStorage.setItem('avian-dark-mode-only', 'true');
};

/**
 * Initializes dark mode enforcement and overrides system preferences
 */
export const initializeDarkMode = () => {
  // Only run in browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  enforceDarkModeOnly();

  // Override any CSS media queries for theme detection
  const style = document.createElement('style');
  style.id = 'dark-mode-enforcement';
  style.textContent = `
    @media (prefers-color-scheme: light) {
      :root { 
        color-scheme: dark !important; 
        --background: #0f172a !important;
        --foreground: #f1f5f9 !important;
      }
      
      html, body {
        background-color: #0f172a !important;
        color: #f1f5f9 !important;
      }
    }
    
    /* Force dark mode styles */
    html, body {
      color-scheme: dark !important;
      background-color: #0f172a !important;
      color: #f1f5f9 !important;
    }
    
    /* Prevent any light mode activation */
    .light,
    .light *,
    [data-theme="light"],
    [data-theme="light"] *,
    [class*="light"],
    [class*="Light"] {
      display: none !important;
      visibility: hidden !important;
    }
    
    /* Override any potential theme classes */
    * {
      color-scheme: dark !important;
    }
    
    /* Force dark mode CSS variables */
    :root {
      --background: #0f172a !important;
      --foreground: #f1f5f9 !important;
      --card: #1e293b !important;
      --card-foreground: #f1f5f9 !important;
      --popover: #1e293b !important;
      --popover-foreground: #f1f5f9 !important;
      --primary: #00d4ff !important;
      --primary-foreground: #0f172a !important;
      --secondary: #334155 !important;
      --secondary-foreground: #f1f5f9 !important;
      --muted: #334155 !important;
      --muted-foreground: #94a3b8 !important;
      --accent: #334155 !important;
      --accent-foreground: #f1f5f9 !important;
      --destructive: #dc2626 !important;
      --destructive-foreground: #f1f5f9 !important;
      --border: #475569 !important;
      --input: #334155 !important;
      --ring: #00d4ff !important;
    }
  `;

  // Remove existing enforcement style if it exists
  const existingStyle = document.getElementById('dark-mode-enforcement');
  if (existingStyle) {
    existingStyle.remove();
  }

  document.head.appendChild(style);
};

/**
 * Theme enforcement configuration and utilities
 * Note: For React hook, use the ThemeProvider and useTheme from contexts/ThemeContext
 */