import { braveSearch } from './search.js';
import { scrapeHomepage } from './scrapers/scrapeHomepage.js';
import { scrapeFieldPage } from './scrapers/scrapeFieldPage.js';
import { mergeUniversityFiles } from './merge.js';
import { UniversityField } from './extract.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import universities from './universities.json' assert { type: "json" };
import 'dotenv/config';

const FIELD_QUERIES = {
  admissionsFocus: 'admissions',
  professors: 'professors',
  studentOrgs: 'student organizations',
  events: 'events',
};

async function findFieldUrls(universityName: string): Promise<Record<string, string>> {
  const fieldPromises = Object.entries(FIELD_QUERIES).map(async ([field, keyword]) => {
    const query = `${universityName} ${keyword}`;
    const urls = await braveSearch(query);
    return [field, urls[0]] as [string, string]; 
  });

  const results = await Promise.all(fieldPromises);

  return Object.fromEntries(results);
}

async function scrapeUniversity(universityName: string, homepageUrl: string) {
  const homepageData = await scrapeHomepage(homepageUrl);
  const fieldUrls = await findFieldUrls(universityName);

  const fieldDataPromises = Object.entries(fieldUrls).map(async ([field, url]) => {
    const data = await scrapeFieldPage(url, field as UniversityField);
    return [field, data] as [string, any];
  });

  const fieldData = Object.fromEntries(await Promise.all(fieldDataPromises));

  const universityData = {
    ...homepageData,
    ...fieldData,
    scrapedAt: new Date().toISOString(),
  };

  return universityData;
}

(async () => {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = `data/${runId}`;
  if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });

  for (const { name, url } of universities) {
    try {
      console.log(`\n🎓 Starting scrape for ${name}...`);

      const data = await scrapeUniversity(name, url);
      if (!data) {
        console.error(`⚠️ No data scraped for ${name}, skipping.`);
        continue;
      }

      const safeName = name.toLowerCase().replace(/\s+/g, "_");
      const outputPath = join(runDir, `${safeName}-${runId}.json`);

      writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved ${safeName} raw data to ${outputPath}`);

      mergeUniversityFiles(safeName, runDir);

    } catch (error) {
      console.error(`❌ Error scraping ${name}:`, error);
    }
  }

  console.log(`\n🎯 All universities scraped and merged! Output directory: ${runDir}`);
})();
