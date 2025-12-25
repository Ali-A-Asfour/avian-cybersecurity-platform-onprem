import { renderHook, act } from '@testing-library/react';
import { useAutoRefresh } from '../useAutoRefresh';

// Mock useNetworkStatus hook
jest.mock('../useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOnline: true })
}));

describe('useAutoRefresh Simple Tests', () => {
    beforeEach(() => {
        jest.useFakeTimers();

        // Mock document properties
        Object.defineProperty(document, 'hidden', {
            writable: true,
            value: false,
        });

        Object.defineProperty(document, 'addEventListener', {
            writable: true,
            value: jest.fn(),
        });

        Object.defineProperty(document, 'removeEventListener', {
            writable: true,
            value: jest.fn(),
        });

        Object.defineProperty(document, 'querySelector', {
            writable: true,
            value: jest.fn().mockReturnValue(null),
        });

        Object.defineProperty(document.body, 'classList', {
            writable: true,
            value: { contains: jest.fn().mockReturnValue(false) },
        });

        // Mock MutationObserver
        global.MutationObserver = jest.fn().mockImplementation(() => ({
            observe: jest.fn(),
            disconnect: jest.fn(),
        }));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should be active when enabled', () => {
        const mockOnRefresh = jest.fn();

        const { result } = renderHook(() =>
            useAutoRefresh({
                onRefresh: mockOnRefresh,
                enabled: true,
            })
        );

        expect(result.current.isActive).toBe(true);
    });

    it('should provide refresh button functionality', () => {
        const mockOnRefresh = jest.fn();

        const { result } = renderHook(() =>
            useAutoRefresh({
                onRefresh: mockOnRefresh,
                enabled: true,
            })
        );

        // Manual refresh should work
        act(() => {
            result.current.refreshNow();
        });

        expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
});