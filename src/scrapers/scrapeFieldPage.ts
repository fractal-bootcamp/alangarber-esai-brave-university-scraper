import { chromium } from 'playwright';
import { extractStructuredData, UniversityField } from '../extract.js';

export async function scrapeFieldPage(url: string, field: UniversityField) {
  console.log(`🔍 Scraping field "${field}" from ${url}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const bodyText = await page.textContent('body');
  const cleanedText = bodyText?.replace(/\s+/g, ' ').trim() || '';

  await browser.close();

  if (!cleanedText) {
    console.warn(`⚠️ No text found at ${url}`);
    return null;
  }

  const extracted = await extractStructuredData(field, cleanedText);

  console.log(`📄 Extracted ${field}:`, extracted ? "✅ Success" : "⚠️ Empty or Failed");
  return extracted;
}
