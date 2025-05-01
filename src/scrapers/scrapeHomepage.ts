import { Browser } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

export async function scrapeHomepage(url: string, browser: Browser) {
  console.log(`🌐 Scraping homepage for ${url}...`);

  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000, // longer timeout for slow pages
    });

    const title = await page.title();

    const description = await page
      .$eval('meta[name="description"]', el => el.getAttribute('content'))
      .catch(() => null);

    return {
      id: uuidv4(),
      name: title?.replace(/[\n\t]/g, '').trim() || 'Unknown University',
      website: url,
      characterSummary: description || '',
    };
  } catch (err) {
    console.error(`❌ Failed to scrape homepage at ${url}:`, err);
    throw err;
  } finally {
    await page.close(); // always close the page!
  }
}
