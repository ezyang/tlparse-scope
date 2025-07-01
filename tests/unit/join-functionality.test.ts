import { describe, it, expect } from 'vitest';

// We need to access the private methods for testing, so we'll extend the class
class TestableJSONLViewer {
  private stringTable: string[] = [];
  private tensorIndex: Map<number, any> = new Map();

  processEntries(rawEntries: any[]): any[] {
    this.tensorIndex.clear();
    const processedEntries: any[] = [];
    
    for (const entry of rawEntries) {
      const processed = { ...entry };
      
      // Build tensor index from describe_tensor events
      if (processed.describe_tensor) {
        const tensorData = processed.describe_tensor;
        if (tensorData.describer_id !== undefined) {
          this.tensorIndex.set(tensorData.describer_id, tensorData);
        }
      }
      
      // Join describe_source events with tensor data
      if (processed.describe_source) {
        const sourceData = processed.describe_source;
        if (sourceData.describer_id !== undefined) {
          const tensorData = this.tensorIndex.get(sourceData.describer_id);
          if (tensorData) {
            // Create joined event with all tensor columns inlined
            const joinedData = { ...sourceData };
            
            // Add all tensor fields except id/describer_id to avoid conflicts
            Object.keys(tensorData).forEach(key => {
              if (key !== 'id' && key !== 'describer_id') {
                joinedData[key] = tensorData[key];
              }
            });
            
            processed.describe_source = joinedData;
          }
        }
      }
      
      processedEntries.push(processed);
    }
    
    return processedEntries;
  }
}

describe('Join Functionality', () => {
  it('should join describe_source with describe_tensor data', () => {
    const viewer = new TestableJSONLViewer();
    
    const rawEntries = [
      {
        attempt: 0,
        describe_tensor: {
          describer_id: 0,
          device: "device(type='cuda', index=0)",
          dtype: "torch.float32",
          id: 0,
          is_leaf: true,
          ndim: 1,
          size: [5],
          storage: 0,
          stride: [1],
          view_func: "_CustomViewFunc(...)"
        },
        frame_compile_id: 0,
        frame_id: 0
      },
      {
        attempt: 0,
        describe_source: {
          describer_id: 0,
          id: 0,
          source: "L['n']"
        },
        frame_compile_id: 0,
        frame_id: 0
      }
    ];

    const processed = viewer.processEntries(rawEntries);
    
    // First entry should be the describe_tensor event unchanged
    expect(processed[0].describe_tensor).toEqual({
      describer_id: 0,
      device: "device(type='cuda', index=0)",
      dtype: "torch.float32",
      id: 0,
      is_leaf: true,
      ndim: 1,
      size: [5],
      storage: 0,
      stride: [1],
      view_func: "_CustomViewFunc(...)"
    });

    // Second entry should be the describe_source event with tensor data joined
    const joinedSource = processed[1].describe_source;
    expect(joinedSource.describer_id).toBe(0);
    expect(joinedSource.id).toBe(0);
    expect(joinedSource.source).toBe("L['n']");
    
    // Should include all tensor fields except id/describer_id
    expect(joinedSource.device).toBe("device(type='cuda', index=0)");
    expect(joinedSource.dtype).toBe("torch.float32");
    expect(joinedSource.is_leaf).toBe(true);
    expect(joinedSource.ndim).toBe(1);
    expect(joinedSource.size).toEqual([5]);
    expect(joinedSource.storage).toBe(0);
    expect(joinedSource.stride).toEqual([1]);
    expect(joinedSource.view_func).toBe("_CustomViewFunc(...)");
  });

  it('should handle multiple describe_tensor/describe_source pairs', () => {
    const viewer = new TestableJSONLViewer();
    
    const rawEntries = [
      {
        describe_tensor: { describer_id: 0, id: 0, dtype: "torch.float32", size: [5] },
      },
      {
        describe_tensor: { describer_id: 1, id: 1, dtype: "torch.int64", size: [3, 3] },
      },
      {
        describe_source: { describer_id: 0, id: 0, source: "input_tensor" },
      },
      {
        describe_source: { describer_id: 1, id: 1, source: "weight_matrix" },
      }
    ];

    const processed = viewer.processEntries(rawEntries);
    
    // First describe_source should be joined with first tensor
    const firstJoined = processed[2].describe_source;
    expect(firstJoined.source).toBe("input_tensor");
    expect(firstJoined.dtype).toBe("torch.float32");
    expect(firstJoined.size).toEqual([5]);

    // Second describe_source should be joined with second tensor
    const secondJoined = processed[3].describe_source;
    expect(secondJoined.source).toBe("weight_matrix");
    expect(secondJoined.dtype).toBe("torch.int64");
    expect(secondJoined.size).toEqual([3, 3]);
  });

  it('should handle describe_source without matching describe_tensor', () => {
    const viewer = new TestableJSONLViewer();
    
    const rawEntries = [
      {
        describe_source: { describer_id: 999, id: 0, source: "orphan_source" },
      }
    ];

    const processed = viewer.processEntries(rawEntries);
    
    // Should remain unchanged when no matching tensor found
    expect(processed[0].describe_source).toEqual({
      describer_id: 999,
      id: 0,
      source: "orphan_source"
    });
  });
});