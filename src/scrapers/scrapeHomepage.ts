import { chromium } from 'playwright'; // or 'playwright-core' if you're bundling
import { v4 as uuidv4 } from 'uuid';

export async function scrapeHomepage(url: string) {
    console.log(`🌐 Scraping homepage for ${url}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Scrape basic fields
  const title = await page.title();
  const description = await page.$eval('meta[name="description"]', el => el.getAttribute('content')).catch(() => null);

  await browser.close();

  // Return a minimal homepage scrape object
  return {
    id: uuidv4(),
    name: title.replace(/[\n\t]/g, '').trim() || "Unknown University",
    website: url,
    characterSummary: description || '',
  };
}
