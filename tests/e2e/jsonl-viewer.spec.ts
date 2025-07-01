import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testData = readFileSync(join(__dirname, '../../tests/fixtures/autotune_with_compile_id.jsonl'), 'utf-8');

test.describe('JSONL Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display initial upload interface', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('JSONL Viewer');
    await expect(page.locator('#file-input')).toBeVisible();
    await expect(page.locator('#url-input')).toBeVisible();
    await expect(page.locator('#load-url')).toBeVisible();
    await expect(page.locator('#drop-zone')).toBeVisible();
    await expect(page.locator('#table-container')).toBeHidden();
  });

  test('should load JSONL file via file picker', async ({ page }) => {
    // Create a temporary file
    const fileContent = testData;
    
    // Upload file
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent)
    });

    // Verify upload section is hidden and table is shown
    await expect(page.locator('#upload-section')).toBeHidden();
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#entry-count')).toContainText('21 entries');
  });

  test('should handle drag and drop file upload', async ({ page }) => {
    const fileInput = page.locator('#file-input');
    
    // Upload file using the file input (simulating drag and drop result)
    const fileContent = testData;
    await fileInput.setInputFiles({
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent)
    });

    // Verify table is displayed
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#entry-count')).toContainText('21 entries');
  });

  test('should toggle column visibility', async ({ page }) => {
    // Upload test file first
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    // Wait for table to load
    await expect(page.locator('#table-container')).toBeVisible();

    // Initially, hidden columns should not be visible
    const timestampHeader = page.locator('th').filter({ hasText: 'timestamp' });
    await expect(timestampHeader).toBeHidden();

    // Toggle show all columns
    await page.check('#show-all-columns');

    // Now hidden columns should be visible
    await expect(timestampHeader).toBeVisible();

    // Toggle back
    await page.uncheck('#show-all-columns');
    await expect(timestampHeader).toBeHidden();
  });

  test('should display consolidated frame column', async ({ page }) => {
    // Upload test file
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    await expect(page.locator('#table-container')).toBeVisible();

    // Check that frame column exists
    const frameHeader = page.locator('th').filter({ hasText: 'frame' });
    await expect(frameHeader).toBeVisible();

    // Check that frame data is properly formatted (0/0 format)
    const firstFrameCell = page.locator('tbody tr:first-child td:first-child');
    await expect(firstFrameCell).toHaveText('0/0');
  });

  test('should display event keys and content correctly', async ({ page }) => {
    // Upload test file
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    await expect(page.locator('#table-container')).toBeVisible();

    // Check event_key column exists
    const eventKeyHeader = page.locator('th').filter({ hasText: 'event_key' });
    await expect(eventKeyHeader).toBeVisible();

    // Check event_content column exists with monospace font
    const eventContentHeader = page.locator('th').filter({ hasText: 'event_content' });
    await expect(eventContentHeader).toBeVisible();

    // Verify first row has dynamo_start event key
    const firstEventKeyCell = page.locator('tbody tr:first-child td').filter({ hasText: 'dynamo_start' });
    await expect(firstEventKeyCell).toBeVisible();

    // Verify event content is properly formatted JSON
    const firstEventContentCell = page.locator('tbody tr:first-child .json-cell');
    await expect(firstEventContentCell).toBeVisible();
    const eventContentText = await firstEventContentCell.textContent();
    expect(eventContentText).toContain('stack');
    expect(eventContentText).toContain('filename');
  });

  test('should process string table and replace interned strings', async ({ page }) => {
    // Upload test file
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    await expect(page.locator('#table-container')).toBeVisible();

    // Check that the first dynamo_start event has replaced filenames
    const firstEventContentCell = page.locator('tbody tr:first-child .json-cell');
    const eventContentText = await firstEventContentCell.textContent();
    
    // Should contain the actual filename from string table, not just index
    expect(eventContentText).toContain('/home/jjwu/test.py');
    // Both stack frames reference index 1 which is /home/jjwu/test.py
    expect(eventContentText).not.toContain('"filename": 1');
  });

  test('should handle URL loading', async ({ page }) => {
    // Mock a successful fetch response
    await page.route('**/test.jsonl', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: testData
      });
    });

    // Enter URL and load
    await page.fill('#url-input', 'http://example.com/test.jsonl');
    await page.click('#load-url');

    // Verify table is displayed
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#entry-count')).toContainText('21 entries');
  });

  test('should handle URL loading with Enter key', async ({ page }) => {
    // Mock a successful fetch response
    await page.route('**/test.jsonl', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: testData
      });
    });

    // Enter URL and press Enter
    await page.fill('#url-input', 'http://example.com/test.jsonl');
    await page.press('#url-input', 'Enter');

    // Verify table is displayed
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#entry-count')).toContainText('21 entries');
  });

  test('should display error for invalid JSONL', async ({ page }) => {
    const invalidJsonl = 'invalid json content';
    
    await page.setInputFiles('#file-input', {
      name: 'invalid.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidJsonl)
    });

    // Should show error message
    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Failed to parse JSONL');
  });

  test('should display error for network failure', async ({ page }) => {
    // Mock a failed fetch response
    await page.route('**/nonexistent.jsonl', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found'
      });
    });

    await page.fill('#url-input', 'http://example.com/nonexistent.jsonl');
    await page.click('#load-url');

    // Should show error message
    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Failed to load from URL');
  });

  test('should have proper table styling and layout', async ({ page }) => {
    // Upload test file
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    await expect(page.locator('#table-container')).toBeVisible();

    // Check table exists
    const table = page.locator('.data-table');
    await expect(table).toBeVisible();

    // Check table has sticky header
    const header = page.locator('.data-table th').first();
    await expect(header).toHaveCSS('position', 'sticky');

    // Check JSON cells have monospace font
    const jsonCell = page.locator('.json-cell').first();
    await expect(jsonCell).toHaveCSS('font-family', /monospace/);

    // Check app element exists and is visible
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should handle empty JSONL file', async ({ page }) => {
    const emptyJsonl = '';
    
    await page.setInputFiles('#file-input', {
      name: 'empty.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(emptyJsonl)
    });

    // Should show error message
    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('No valid JSONL entries found');
  });

  test('should handle JSONL with only string table', async ({ page }) => {
    const onlyStringTable = '{"string_table":["file1.py","file2.py"]}';
    
    await page.setInputFiles('#file-input', {
      name: 'only-string-table.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(onlyStringTable)
    });

    // Should show table container and 0 entries
    await expect(page.locator('#table-container')).toBeVisible();
    await expect(page.locator('#entry-count')).toContainText('0 entries');
  });

  test('should auto-hide error messages', async ({ page }) => {
    const invalidJsonl = 'invalid json content';
    
    await page.setInputFiles('#file-input', {
      name: 'invalid.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidJsonl)
    });

    // Error should be visible initially
    await expect(page.locator('#error-message')).toBeVisible();

    // Wait for auto-hide (5 seconds)
    await page.waitForTimeout(5100);
    await expect(page.locator('#error-message')).toBeHidden();
  });
});