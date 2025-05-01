import { chromium, Browser } from 'playwright';
import { braveSearch } from './search.js';
import { scrapeHomepage } from './scrapers/scrapeHomepage.js';
import { scrapeFieldPage } from './scrapers/scrapeFieldPage.js';
import { mergeUniversityFiles } from './merge.js';
import { writeFileSync, mkdirSync, existsSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';
import pLimit from 'p-limit';
import 'dotenv/config';
import { loadSchema } from './loadSchema.js';

interface University {
  name: string;
  url: string;
}

const SCHEMA_PATH = './src/schema.json';
const UNIVERSITIES_PATH = './src/universities.json';

const schemaJSON = process.env.SCHEMA_JSON;
const universityJSON = process.env.UNIVERSITIES_JSON;

const {
  schema,
  fieldQueries,
  fieldTypes,
  fieldAvoidList,
  globalAvoidList,
} = schemaJSON ? loadSchema(undefined, schemaJSON) : loadSchema(SCHEMA_PATH);

const universities: University[] = universityJSON
  ? JSON.parse(universityJSON)
  : JSON.parse(readFileSync(UNIVERSITIES_PATH, 'utf-8'));

function setupRun() {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = `data/${runId}`;
  if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });
  return { runId, runDir };
}

function logToFile(message: string, runDir: string) {
  const logPath = join(runDir, 'scrape-log.txt');
  appendFileSync(logPath, message + '\n');
}

function shouldAvoid(rawUrl: string, field: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();

    const allBanned = new Set([
      ...globalAvoidList.map(d => d.toLowerCase()),
      ...(fieldAvoidList[field] || []).map(d => d.toLowerCase()),
    ]);

    return Array.from(allBanned).some(
      banned => hostname === banned || hostname.endsWith(`.${banned}`)
    );
  } catch {
    return false;
  }
}

async function findFieldUrls(universityName: string): Promise<Record<string, string[]>> {
  const queries = Object.entries(fieldQueries).map(([field, keyword]) => ({
    field,
    query: `${universityName} ${keyword}`,
  }));

  const searchResults = await Promise.all(
    queries.map(({ query }) => braveSearch(query))
  );

  return Object.fromEntries(
    queries.map(({ field }, i) => {
      const urls = searchResults[i]
        .filter(url => !shouldAvoid(url, field))
        .slice(0, 3);
      return [field, urls];
    })
  );
}

async function scrapeUniversity(
  universityName: string,
  homepageUrl: string,
  runId: string,
  runDir: string,
  browser: Browser
) {
  try {
    console.log(`\n🎓 Starting scrape for ${universityName}...`);
    const homepageData = await scrapeHomepage(homepageUrl, browser);
    console.log(`🌐 Scraped homepage for ${universityName}`);

    const fieldUrls = await findFieldUrls(universityName);
    const pageLimit = pLimit(3); // Moderate parallelism for field scraping

    const fieldDataPromises = Object.entries(fieldUrls).map(async ([field, urls]) => {
      const zodField = schema.shape[field];
      const fieldType = fieldTypes[field];

      const results = await Promise.all(
        urls.map(url =>
          pageLimit(() =>
            scrapeFieldPage(url, field, zodField, fieldType, browser)
          )
        )
      );

      const successfulResults = results.filter(Boolean);
      const value =
        fieldType === 'array'
          ? successfulResults.flat()
          : successfulResults.join(' ');

      return [field, value];
    });

    const fieldData = Object.fromEntries(await Promise.all(fieldDataPromises));

    const universityData = {
      ...homepageData,
      ...fieldData,
      scrapedAt: new Date().toISOString(),
    };

    const safeName = universityName.toLowerCase().replace(/\s+/g, '_');
    const outputPath = join(runDir, `${safeName}-${runId}.json`);

    writeFileSync(outputPath, JSON.stringify(universityData, null, 2));
    console.log(`✅ Saved ${safeName} raw data to ${outputPath}`);

    mergeUniversityFiles(safeName, runDir, schemaJSON ? undefined : SCHEMA_PATH);
    logToFile(`✅ Scraped ${universityName}`, runDir);
  } catch (error) {
    console.error(`❌ Error scraping ${universityName}:`, error);
    logToFile(`❌ Failed ${universityName}: ${error}`, runDir);
  }
}

(async () => {
  const { runId, runDir } = setupRun();
  const browser = await chromium.launch({ headless: true });

  for (const { name, url } of universities) {
    await scrapeUniversity(name, url, runId, runDir, browser);
  }

  await browser.close();
  console.log(`\n🎯 All universities scraped and merged! Output directory: ${runDir}`);
})();
