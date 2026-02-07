/**
 * Unit tests for GenerateCtrfReport deep merge functionality
 */

import GenerateCtrfReport from './generate-report'

describe('GenerateCtrfReport', () => {
  describe('deepMerge', () => {
    let reporter: GenerateCtrfReport

    beforeEach(() => {
      reporter = new GenerateCtrfReport()
    })

    it('should concatenate arrays', () => {
      const target = { tags: ['smoke'] }
      const source = { tags: ['e2e'] }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ tags: ['smoke', 'e2e'] })
    })

    it('should concatenate arrays from empty target', () => {
      const target = {}
      const source = { tags: ['smoke'] }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ tags: ['smoke'] })
    })

    it('should merge objects deeply', () => {
      const target = { build: { id: '123' } }
      const source = { build: { branch: 'main' } }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ build: { id: '123', branch: 'main' } })
    })

    it('should merge nested objects deeply', () => {
      const target = { meta: { build: { id: '123' } } }
      const source = { meta: { build: { url: 'https://...' } } }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({
        meta: { build: { id: '123', url: 'https://...' } },
      })
    })

    it('should overwrite primitives', () => {
      const target = { owner: 'platform-team' }
      const source = { owner: 'checkout-team' }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ owner: 'checkout-team' })
    })

    it('should preserve non-overlapping keys', () => {
      const target = { owner: 'platform-team', priority: 'P1' }
      const source = { retries: 3 }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({
        owner: 'platform-team',
        priority: 'P1',
        retries: 3,
      })
    })

    it('should handle complex nested structures', () => {
      const target = {
        tags: ['smoke'],
        build: { id: '123', metadata: { author: 'alice' } },
        retries: 1,
      }
      const source = {
        tags: ['e2e', 'regression'],
        build: { branch: 'main', metadata: { timestamp: '2026-02-06' } },
        retries: 2,
        owner: 'platform',
      }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({
        tags: ['smoke', 'e2e', 'regression'],
        build: {
          id: '123',
          branch: 'main',
          metadata: { author: 'alice', timestamp: '2026-02-06' },
        },
        retries: 2,
        owner: 'platform',
      })
    })

    it('should replace object with primitive', () => {
      const target = { config: { timeout: 5000 } }
      const source = { config: 'default' }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ config: 'default' })
    })

    it('should replace primitive with object', () => {
      const target = { config: 'default' }
      const source = { config: { timeout: 5000 } }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ config: { timeout: 5000 } })
    })

    it('should replace primitive with array', () => {
      const target = { tags: 'smoke' }
      const source = { tags: ['e2e'] }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ tags: ['e2e'] })
    })

    it('should handle null values', () => {
      const target = { value: null }
      const source = { value: 'something' }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ value: 'something' })
    })

    it('should handle empty objects', () => {
      const target = {}
      const source = { owner: 'platform' }
      // @ts-expect-error - accessing private method for testing
      const result = reporter.deepMerge(target, source)
      expect(result).toEqual({ owner: 'platform' })
    })

    it('should not mutate original objects', () => {
      const target = { tags: ['smoke'], build: { id: '123' } }
      const source = { tags: ['e2e'], build: { branch: 'main' } }
      // @ts-expect-error - accessing private method for testing
      reporter.deepMerge(target, source)
      expect(target).toEqual({ tags: ['smoke'], build: { id: '123' } })
      expect(source).toEqual({ tags: ['e2e'], build: { branch: 'main' } })
    })
  })
})
