import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testData = readFileSync(join(__dirname, '../../tests/fixtures/autotune_with_compile_id.jsonl'), 'utf-8');

test.describe('localStorage persistence', () => {
  test('should persist JSONL data across page reloads', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the initial load
    await expect(page.locator('#upload-section')).toBeVisible();

    // Upload the file
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    // Wait for the table to appear and verify data is loaded
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#upload-section')).not.toBeVisible();
    
    // Verify we have entries displayed
    const entryCount = page.locator('#entry-count');
    await expect(entryCount).toContainText('entries');
    
    // Get the entry count text to verify later
    const initialEntryText = await entryCount.textContent();

    // Verify table has data
    const tableRows = page.locator('#table-body tr');
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Get some sample data from first row to verify later
    const firstRowText = await tableRows.first().textContent();

    // Trigger a page reload
    await page.reload();

    // After reload, verify the data is still there (not showing upload section)
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#upload-section')).not.toBeVisible();

    // Verify entry count matches
    await expect(entryCount).toContainText(initialEntryText || '');

    // Verify table data is the same
    const reloadedTableRows = page.locator('#table-body tr');
    const reloadedRowCount = await reloadedTableRows.count();
    expect(reloadedRowCount).toBe(rowCount);

    // Verify first row content matches
    const reloadedFirstRowText = await reloadedTableRows.first().textContent();
    expect(reloadedFirstRowText).toBe(firstRowText);

    // Test clear functionality
    const clearButton = page.locator('#clear-data');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // After clearing, should return to upload section
    await expect(page.locator('#upload-section')).toBeVisible();
    await expect(page.locator('#table-container')).not.toBeVisible();

    // Reload again to verify data is actually cleared
    await page.reload();
    await expect(page.locator('#upload-section')).toBeVisible();
    await expect(page.locator('#table-container')).not.toBeVisible();
  });

  test('should handle localStorage corruption gracefully', async ({ page }) => {
    // Set corrupted data in localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('tlparse-jsonl-data', 'invalid json data');
    });

    // Reload the page
    await page.reload();

    // Should show upload section (not crash)
    await expect(page.locator('#upload-section')).toBeVisible();
    await expect(page.locator('#table-container')).not.toBeVisible();
  });
});