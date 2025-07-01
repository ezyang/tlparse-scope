import { test, expect } from '@playwright/test';

test.describe('Join Functionality', () => {
  test('should join describe_source events with describe_tensor data', async ({ page }) => {
    await page.goto('http://localhost:4173/');

    const jsonlData = `{"string_table":["test_file.py"]}
{"attempt":0,"describe_tensor":{"describer_id":0,"device":"device(type='cuda', index=0)","dtype":"torch.float32","id":0,"is_leaf":true,"ndim":1,"size":[5],"storage":0,"stride":[1]},"frame_compile_id":0,"frame_id":0}
{"attempt":0,"describe_source":{"describer_id":0,"id":0,"source":"L['input']"},"frame_compile_id":0,"frame_id":0}`;

    // Create a file and upload it
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('input[type="file"]')
    ]);
    
    await fileChooser.setFiles({
      name: 'test-join.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(jsonlData)
    });

    // Wait for the table to load
    await expect(page.locator('#table-container')).toBeVisible();
    
    // Filter to show only describe_source events
    await page.selectOption('#event-filter', 'describe_source');
    
    // Check that the table shows the joined data
    const tableRows = page.locator('#data-table tbody tr');
    await expect(tableRows).toHaveCount(1);
    
    // Verify that we have columns from both source and tensor data
    const headerCells = page.locator('#data-table thead th');
    const headerTexts = await headerCells.allTextContents();
    
    // Should include standard columns plus tensor-specific columns
    // Note: when filtering by specific event, event_key column is hidden
    expect(headerTexts).toContain('frame');
    expect(headerTexts).not.toContain('event_key');
    
    // When filtering by describe_source, we should see individual columns
    // including tensor fields like dtype, device, size, etc.
    expect(headerTexts.some(text => text === 'dtype' || text === 'device' || text === 'size')).toBe(true);
    
    // Check the actual row data
    const firstRow = tableRows.first();
    const cells = firstRow.locator('td');
    
    // Should contain both source and tensor data
    if (headerTexts.includes('source')) {
      const sourceCell = cells.nth(headerTexts.indexOf('source'));
      await expect(sourceCell).toHaveText("L['input']");
    }
    
    if (headerTexts.includes('dtype')) {
      const dtypeCell = cells.nth(headerTexts.indexOf('dtype'));
      await expect(dtypeCell).toHaveText('torch.float32');
    }
    
    if (headerTexts.includes('device')) {
      const deviceCell = cells.nth(headerTexts.indexOf('device'));
      await expect(deviceCell).toHaveText("device(type='cuda', index=0)");
    }
  });

  test('should show separate describe_tensor and describe_source events when filtering by "all"', async ({ page }) => {
    await page.goto('http://localhost:4173/');

    const jsonlData = `{"string_table":["test_file.py"]}
{"attempt":0,"describe_tensor":{"describer_id":0,"device":"device(type='cuda', index=0)","dtype":"torch.float32","id":0,"is_leaf":true,"ndim":1,"size":[5],"storage":0,"stride":[1]},"frame_compile_id":0,"frame_id":0}
{"attempt":0,"describe_source":{"describer_id":0,"id":0,"source":"L['input']"},"frame_compile_id":0,"frame_id":0}`;

    // Upload the data
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('input[type="file"]')
    ]);
    
    await fileChooser.setFiles({
      name: 'test-join.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(jsonlData)
    });

    // Wait for the table to load
    await expect(page.locator('#table-container')).toBeVisible();
    
    // Keep "All Events" selected (default)
    const eventFilter = page.locator('#event-filter');
    await expect(eventFilter).toHaveValue('all');
    
    // Should show both events as separate rows
    const tableRows = page.locator('#data-table tbody tr');
    await expect(tableRows).toHaveCount(2);
    
    // Check that we have both event types by looking at the event_key column
    const headerCells = page.locator('#data-table thead th');
    const headerTexts = await headerCells.allTextContents();
    const eventKeyColumnIndex = headerTexts.indexOf('event_key');
    
    // event_key column should exist when showing all events
    expect(eventKeyColumnIndex).toBeGreaterThan(-1);
    
    const eventKeyCells = page.locator(`#data-table tbody tr td:nth-child(${eventKeyColumnIndex + 1})`);
    const eventKeyTexts = await eventKeyCells.allTextContents();
    
    expect(eventKeyTexts).toContain('describe_tensor');
    expect(eventKeyTexts).toContain('describe_source');
  });
});