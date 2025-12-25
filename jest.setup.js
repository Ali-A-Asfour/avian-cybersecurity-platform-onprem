// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Import fast-check for property-based testing
import '@fast-check/jest'

// Polyfill TextEncoder/TextDecoder for Node.js test environment
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill crypto for Web Crypto API
const { webcrypto } = require('crypto')
Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true
})

// Polyfill fetch for Node.js test environment (Node 18+ has native fetch)
if (!global.fetch) {
    const nodeFetch = require('node-fetch')
    global.fetch = nodeFetch.default || nodeFetch
    global.Headers = nodeFetch.Headers
    global.Request = nodeFetch.Request
    global.Response = nodeFetch.Response
}

// Polyfill Response.json for test environment
if (global.Response && !global.Response.json) {
    global.Response.json = function (data) {
        return new global.Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

// Mock ResizeObserver for Recharts components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}))

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
process.env.NODE_ENV = 'development' // Use 'development' to enable auth bypass for now
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.BYPASS_AUTH = 'true' // Enable auth bypass in tests temporarily for MVP
