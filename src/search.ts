import fetch from 'node-fetch';
import 'dotenv/config';

interface BraveSearchResult {
    web: {
      results: { url: string }[];
    };
  }

  export async function braveSearch(query: string): Promise<string[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Cannot search with empty query');
    }
  
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': process.env.BRAVE_API_KEY!,
      },
    });  

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.statusText}`);
  }

  const data = (await response.json()) as BraveSearchResult;
  const urls = data.web.results.map((r: any) => r.url);
  return urls.slice(0, 3);
}
