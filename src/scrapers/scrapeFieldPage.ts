import { chromium } from 'playwright';
import { extractStructuredData, UniversityField } from '../extract.js';

export async function scrapeFieldPage(url: string, field: UniversityField) {
  console.log(`🔍 Scraping field "${field}" from ${url}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const bodyText = await page.textContent('body');
    const cleanedText = bodyText?.replace(/\s+/g, ' ').trim() || '';

    if (!cleanedText) {
      console.warn(`⚠️ No text found at ${url}`);
      return null;
    }

    const pageContent = await page.content();
    const truncatedContent = pageContent.slice(0, 15000); // limit to 15,000 characters
    const structuredData = await extractStructuredData(truncatedContent as UniversityField, field);

    console.log(`📄 Extracted ${field}:`, structuredData ? "✅ Success" : "⚠️ Empty or Failed");
    return structuredData;
  } catch (error) {
    console.error(`❌ Error scraping field "${field}" at ${url}:`, error);
    return null;
  } finally {
    await page.close(); // 🛑 always close the page, even if error
    await browser.close(); // 🛑 also close the browser, even if error
  }
}
