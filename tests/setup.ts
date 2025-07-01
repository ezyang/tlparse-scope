import { beforeEach, vi } from 'vitest'

// Add jsdom globals for testing
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'TextEncoder', {
    writable: true,
    value: TextEncoder,
  })

  Object.defineProperty(window, 'TextDecoder', {
    writable: true,
    value: TextDecoder,
  })
}

// Mock fetch for unit tests
global.fetch = vi.fn()

beforeEach(() => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
  }
  vi.clearAllMocks()
})