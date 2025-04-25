import { braveSearch } from './search.js';
import { scrapeHomepage } from './scrapers/scrapeHomepage.js';
import { scrapeFieldPage } from './scrapers/scrapeFieldPage.js';
import { mergeUniversityFiles } from './merge.js';
import { UniversityField } from './extract.js';
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import universities from './universities.json' assert { type: "json" };
import pLimit from 'p-limit';
import 'dotenv/config';

const FIELD_QUERIES = {
  admissionsFocus: 'admissions',
  professors: 'professors',
  studentOrgs: 'student organizations',
  events: 'events',
} as const;

function setupRun() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = `data/${runId}`;
  if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });
  return { runId, runDir };
}

function logToFile(message: string, runDir: string) {
  const logPath = join(runDir, "scrape-log.txt");
  appendFileSync(logPath, message + "\n");
}

// 🆕 Updated version of findFieldUrls to return multiple URLs per field
async function findFieldUrls(universityName: string): Promise<Record<string, string[]>> {
  const queries = Object.entries(FIELD_QUERIES).map(([field, keyword]) => ({
    field,
    query: `${universityName} ${keyword}`,
  }));

  const searchResults = await Promise.all(
    queries.map(({ query }) => braveSearch(query))
  );

  const fieldUrlPairs = queries.map(({ field }, i) => {
    const filteredUrls = searchResults[i]
      .filter(url => !url.includes("usnews.com")) // ❗ exclude bad domains
      .slice(0, 3); // still grab top 3

    return [field, filteredUrls];
  });

  return Object.fromEntries(fieldUrlPairs);
}

// 🆕 Updated scrapeUniversity to handle multiple URLs per field
async function scrapeUniversity(universityName: string, homepageUrl: string, runId: string, runDir: string) {
  try {
    console.log(`\n🎓 Starting scrape for ${universityName}...`);
    const homepageData = await scrapeHomepage(homepageUrl);
    console.log(`🌐 Scraped homepage for ${universityName}`);

    const fieldUrls = await findFieldUrls(universityName);

    const pageLimit = pLimit(2); // 🆕 limit 2 concurrent page scrapes per university

    const fieldDataPromises = Object.entries(fieldUrls).map(async ([field, urls]) => {
      const results = await Promise.all(
        urls.map(url => 
          pageLimit(async () => {
            console.log(`🔍 Scraping field "${field}" from ${url}`);
            return scrapeFieldPage(url, field as UniversityField);
          })
        )
      );
    
      const successfulResults = results.filter(Boolean);    

      if (field === 'knownFor' || field === 'studentOrgs' || field === 'professors' || field === 'events') {
        return [field, successfulResults.flat()];
      } else {
        return [field, successfulResults.join(' ')];
      }
    
    });

    const fieldData = Object.fromEntries(await Promise.all(fieldDataPromises));

    const universityData = {
      ...homepageData,
      ...fieldData,
      scrapedAt: new Date().toISOString(),
    };

    const safeName = universityName.toLowerCase().replace(/\s+/g, "_");
    const outputPath = join(runDir, `${safeName}-${runId}.json`);

    writeFileSync(outputPath, JSON.stringify(universityData, null, 2));
    console.log(`✅ Saved ${safeName} raw data to ${outputPath}`);

    mergeUniversityFiles(safeName, runDir);
    logToFile(`✅ Scraped ${universityName}`, runDir);
  } catch (error) {
    console.error(`❌ Error scraping ${universityName}:`, error);
    logToFile(`❌ Failed ${universityName}: ${error}`, runDir);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const { runId, runDir } = setupRun();
  const limit = pLimit(3); // Limit concurrency to 3 universities at once

  for (const { name, url } of universities) {
    await limit(() => scrapeUniversity(name, url, runId, runDir));
    await sleep(3000); // 💤 wait 3 seconds after each university
  }

  console.log(`\n🎯 All universities scraped and merged! Output directory: ${runDir}`);
})();
