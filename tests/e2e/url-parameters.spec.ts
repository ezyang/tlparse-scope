import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testData = readFileSync(join(__dirname, '../../tests/fixtures/autotune_with_compile_id.jsonl'), 'utf-8');

test.describe('URL Parameters', () => {
  test('should persist filter settings in URL parameters', async ({ page }) => {
    // Load the app
    await page.goto('/');
    
    // Upload test data
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    // Wait for table to load
    await expect(page.locator('#table-container')).toBeVisible();
    
    // Change event filter
    await page.selectOption('#event-filter', 'dynamo_start');
    
    // Check URL has been updated
    await expect(page).toHaveURL(/[?&]event=dynamo_start/);
    
    // Change frame filter
    await page.selectOption('#frame-filter', { index: 1 }); // Select first non-"all" option
    
    // Check URL has been updated with frame parameter
    await expect(page).toHaveURL(/[?&]frame=/);
    
    // Toggle show all columns
    await page.check('#show-all-columns');
    
    // Check URL has been updated with showAll parameter
    await expect(page).toHaveURL(/[?&]showAll=true/);
  });

  test('should load filter settings from URL parameters on page load', async ({ page }) => {
    // Load the app with URL parameters
    await page.goto('/?event=dynamo_start&showAll=true');
    
    // Upload test data
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    // Wait for table to load
    await expect(page.locator('#table-container')).toBeVisible();
    
    // Verify filter settings are applied
    await expect(page.locator('#event-filter')).toHaveValue('dynamo_start');
    await expect(page.locator('#show-all-columns')).toBeChecked();
    
    // Verify URL parameters are still present
    await expect(page).toHaveURL(/[?&]event=dynamo_start/);
    await expect(page).toHaveURL(/[?&]showAll=true/);
  });

  test('should preserve URL parameters when reloading page', async ({ page }) => {
    // Load the app with URL parameters
    await page.goto('/?event=dynamo_start&showAll=true');
    
    // Upload test data
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    // Wait for table to load
    await expect(page.locator('#table-container')).toBeVisible();
    
    // Verify settings are applied
    await expect(page.locator('#event-filter')).toHaveValue('dynamo_start');
    await expect(page.locator('#show-all-columns')).toBeChecked();
    
    // Reload the page
    await page.reload();
    
    // Verify URL parameters are preserved after reload
    await expect(page).toHaveURL(/[?&]event=dynamo_start/);
    await expect(page).toHaveURL(/[?&]showAll=true/);
    
    // Upload test data again
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    await expect(page.locator('#table-container')).toBeVisible();
    
    // Verify settings are still applied after reload
    await expect(page.locator('#event-filter')).toHaveValue('dynamo_start');
    await expect(page.locator('#show-all-columns')).toBeChecked();
  });

  test('should clear URL parameters when clearing data', async ({ page }) => {
    // Load the app
    await page.goto('/');
    
    // Upload test data
    await page.setInputFiles('#file-input', {
      name: 'test.jsonl',
      mimeType: 'application/json',
      buffer: Buffer.from(testData)
    });

    await expect(page.locator('#table-container')).toBeVisible();
    
    // Set some filters
    await page.selectOption('#event-filter', 'dynamo_start');
    await page.check('#show-all-columns');
    
    // Verify URL has parameters
    await expect(page).toHaveURL(/[?&]event=dynamo_start/);
    await expect(page).toHaveURL(/[?&]showAll=true/);
    
    // Clear data
    await page.click('#clear-data');
    
    // Verify URL parameters are cleared
    await expect(page).toHaveURL(/^[^?]*$/); // No query parameters
    await expect(page.locator('#upload-section')).toBeVisible();
  });
});