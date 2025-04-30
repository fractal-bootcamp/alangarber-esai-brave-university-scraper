import { chromium } from 'playwright';
import { extractStructuredData } from '../extract.js';
import { ZodTypeAny } from 'zod';
import { FieldType } from '../loadSchema.js';

export async function scrapeFieldPage(
  url: string,
  field: string,
  zodSchema: ZodTypeAny,
  fieldType: FieldType
) {
  console.log(`🔍 Scraping field "${field}" from ${url}...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const bodyText = await page.textContent('body');
    const cleaned = bodyText?.replace(/\s+/g, ' ').trim() || '';

    if (!cleaned) {
      console.warn(`⚠️ No text found at ${url}`);
      return null;
    }

    const data = await extractStructuredData({
      field,
      text: cleaned.slice(0, 20000),
      zodSchema,
      fieldType,
    });

    console.log(`📄 Extracted ${field}:`, data ? "✅ Success" : "⚠️ Empty or Failed");
    return data;
  } catch (err) {
    console.error(`❌ Error at ${url}:`, err);
    return null;
  } finally {
    await page.close();
    await browser.close();
  }
}
