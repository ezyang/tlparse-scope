import { test, expect } from '@playwright/test';

test.describe('Basic JSONL Viewer', () => {
  test('should display initial interface', async ({ page }) => {
    await page.goto('http://localhost:4173/');
    
    // Check basic elements are present
    await expect(page.locator('h1')).toHaveText('JSONL Viewer');
    await expect(page.locator('#file-input')).toBeVisible();
    await expect(page.locator('#url-input')).toBeVisible();
    await expect(page.locator('#drop-zone')).toBeVisible();
  });

  test('should handle simple JSONL data', async ({ page }) => {
    await page.goto('http://localhost:4173/');
    
    // Create simple test data
    const testData = '{"string_table":["file1.py","file2.py"]}\n{"frame_id":0,"frame_compile_id":0,"attempt":0,"test_event":{"data":"test"}}';
    
    // Upload the data
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    // Check that table appears
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#entry-count')).toContainText('1 entries');
    
    // Check that frame column is formatted correctly
    const frameCell = page.locator('tbody tr:first-child td:first-child');
    await expect(frameCell).toHaveText('0/0');
    
    // Check that event_key and event_content columns exist
    const eventKeyHeader = page.locator('th').filter({ hasText: 'event_key' });
    await expect(eventKeyHeader).toBeVisible();
    
    const eventContentHeader = page.locator('th').filter({ hasText: 'event_content' });
    await expect(eventContentHeader).toBeVisible();
    
    // Check event key shows the correct value
    const eventKeyCell = page.locator('tbody tr:first-child').locator('td').filter({ hasText: 'test_event' });
    await expect(eventKeyCell).toBeVisible();
  });
});