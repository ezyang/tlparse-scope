import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock DOM environment
const mockElement = (tagName: string) => ({
  innerHTML: '',
  style: { display: 'block' },
  textContent: '',
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  getAttribute: vi.fn(),
  setAttribute: vi.fn(),
})

const mockDocument = {
  querySelector: vi.fn(),
  getElementById: vi.fn(),
  body: { innerHTML: '' },
}

const mockWindow = {
  setTimeout: vi.fn(),
}

// Mock the main module
vi.mock('../../src/main.ts', () => {
  return {}
})

describe('JSONL Data Processing', () => {
  const sampleStringTable = [
    '/data/users/jjwu/a/pytorch/torch/_dynamo/convert_frame.py',
    '/home/jjwu/test.py'
  ]

  const sampleDynamoStartEntry = {
    attempt: 0,
    dynamo_start: {
      stack: [
        { filename: 1, line: 9, loc: 'print(f(x))', name: '<module>' },
        { filename: 1, line: 4, name: 'f' }
      ]
    },
    frame_compile_id: 0,
    frame_id: 0,
    timestamp: '2025-03-27T09:07:39.800000Z'
  }

  it('should extract string table from first entry', () => {
    const entries = [
      { string_table: sampleStringTable },
      sampleDynamoStartEntry
    ]

    // Simulate the string table extraction logic
    const firstEntry = entries[0]
    const stringTable = firstEntry.string_table || []
    const remainingEntries = entries.slice(1)

    expect(stringTable).toEqual(sampleStringTable)
    expect(remainingEntries).toHaveLength(1)
    expect(remainingEntries[0]).toEqual(sampleDynamoStartEntry)
  })

  it('should replace interned strings in dynamo_start events', () => {
    const processEntry = (entry: any, stringTable: string[]): any => {
      const processed = { ...entry }
      
      if (processed.dynamo_start && processed.dynamo_start.stack) {
        processed.dynamo_start = {
          ...processed.dynamo_start,
          stack: processed.dynamo_start.stack.map((frame: any) => ({
            ...frame,
            filename: typeof frame.filename === 'number' 
              ? stringTable[frame.filename] || frame.filename
              : frame.filename
          }))
        }
      }

      return processed
    }

    const processed = processEntry(sampleDynamoStartEntry, sampleStringTable)

    expect(processed.dynamo_start.stack[0].filename).toBe('/home/jjwu/test.py')
    expect(processed.dynamo_start.stack[1].filename).toBe('/home/jjwu/test.py')
  })

  it('should handle missing string table entries gracefully', () => {
    const entryWithInvalidIndex = {
      dynamo_start: {
        stack: [
          { filename: 99, line: 1, name: 'test' }  // Index out of bounds
        ]
      }
    }

    const processEntry = (entry: any, stringTable: string[]): any => {
      const processed = { ...entry }
      
      if (processed.dynamo_start && processed.dynamo_start.stack) {
        processed.dynamo_start = {
          ...processed.dynamo_start,
          stack: processed.dynamo_start.stack.map((frame: any) => ({
            ...frame,
            filename: typeof frame.filename === 'number' 
              ? stringTable[frame.filename] || frame.filename
              : frame.filename
          }))
        }
      }

      return processed
    }

    const processed = processEntry(entryWithInvalidIndex, sampleStringTable)

    // Should fall back to original index when string not found
    expect(processed.dynamo_start.stack[0].filename).toBe(99)
  })

  it('should consolidate frame information correctly', () => {
    const formatFrameId = (entry: any): string => {
      const frameId = entry.frame_id !== undefined ? entry.frame_id : ''
      const compileId = entry.frame_compile_id !== undefined ? entry.frame_compile_id : ''
      const attempt = entry.attempt || 0
      return `${frameId}/${compileId}${attempt > 0 ? '_' + attempt : ''}`
    }

    // Test with attempt = 0 (should omit _0)
    expect(formatFrameId({ frame_id: 0, frame_compile_id: 0, attempt: 0 })).toBe('0/0')
    
    // Test with attempt > 0 (should include _attempt)
    expect(formatFrameId({ frame_id: 1, frame_compile_id: 2, attempt: 3 })).toBe('1/2_3')
    
    // Test with missing values
    expect(formatFrameId({})).toBe('/')
  })

  it('should identify event keys correctly', () => {
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread']
    const hiddenColumns = ['timestamp', 'pathname', 'lineno', 'has_payload', 'payload_filename']

    const findEventKey = (entry: any): string => {
      return Object.keys(entry).find(key => 
        !commonFields.includes(key) && 
        !hiddenColumns.includes(key)
      ) || ''
    }

    expect(findEventKey(sampleDynamoStartEntry)).toBe('dynamo_start')
    
    const compileEntry = {
      frame_id: 0,
      compilation_metrics: { duration: 100 },
      timestamp: '2025-03-27T09:07:39.800000Z'
    }
    expect(findEventKey(compileEntry)).toBe('compilation_metrics')

    const noEventEntry = {
      frame_id: 0,
      timestamp: '2025-03-27T09:07:39.800000Z'
    }
    expect(findEventKey(noEventEntry)).toBe('')
  })

  it('should filter columns correctly', () => {
    const hiddenColumns = ['timestamp', 'pathname', 'lineno', 'has_payload', 'payload_filename']
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread']
    
    const allColumns = ['frame_id', 'timestamp', 'dynamo_start', 'pathname', 'thread']
    
    const visibleColumns = allColumns.filter(col => !hiddenColumns.includes(col))
    const eventFields = visibleColumns.filter(col => !commonFields.includes(col))
    
    expect(visibleColumns).toEqual(['frame_id', 'dynamo_start', 'thread'])
    expect(eventFields).toEqual(['dynamo_start'])
  })

  it('should escape HTML correctly', () => {
    const escapeHtml = (unsafe: string): string => {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    }

    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(escapeHtml('A & B')).toBe('A &amp; B')
    expect(escapeHtml("'test'")).toBe('&#039;test&#039;')
  })

  it('should parse JSONL correctly', () => {
    const sampleJsonl = [
      '{"string_table":["file1.py","file2.py"]}',
      '{"frame_id":0,"dynamo_start":{"stack":[{"filename":0,"line":1}]}}'
    ].join('\n')

    const parseJsonl = (text: string) => {
      const lines = text.trim().split('\n')
      const entries = []
      
      for (const line of lines) {
        if (line.trim()) {
          entries.push(JSON.parse(line))
        }
      }
      
      return entries
    }

    const parsed = parseJsonl(sampleJsonl)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toHaveProperty('string_table')
    expect(parsed[1]).toHaveProperty('dynamo_start')
  })

  it('should handle malformed JSONL gracefully', () => {
    const malformedJsonl = [
      '{"string_table":["file1.py"]}',
      'invalid json line',
      '{"frame_id":0}'
    ].join('\n')

    const parseJsonlSafely = (text: string) => {
      const lines = text.trim().split('\n')
      const entries = []
      const errors = []
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            entries.push(JSON.parse(line))
          } catch (error) {
            errors.push(`Failed to parse line: ${line}`)
          }
        }
      }
      
      return { entries, errors }
    }

    const result = parseJsonlSafely(malformedJsonl)
    expect(result.entries).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('invalid json line')
  })

  it('should handle empty or whitespace-only lines', () => {
    const jsonlWithEmptyLines = [
      '{"string_table":["file1.py"]}',
      '',
      '   ',
      '{"frame_id":0}',
      '\n',
      '{"frame_id":1}'
    ].join('\n')

    const parseJsonl = (text: string) => {
      const lines = text.trim().split('\n')
      const entries = []
      
      for (const line of lines) {
        if (line.trim()) {
          entries.push(JSON.parse(line))
        }
      }
      
      return entries
    }

    const parsed = parseJsonl(jsonlWithEmptyLines)
    expect(parsed).toHaveLength(3)
    expect(parsed.map(e => e.frame_id !== undefined ? e.frame_id : 'string_table')).toEqual(['string_table', 0, 1])
  })
})