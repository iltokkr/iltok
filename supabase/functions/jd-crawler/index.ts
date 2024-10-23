import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { DOMParser, Element } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts"

const BASE_URL = "https://www.11482.com"
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

async function getPage(url: string): Promise<Document> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    },
  });
  const html = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html")!;
}

function parseJobPosting(jobElement: Element): Record<string, string> {
  const jobData: Record<string, string> = {
    title: jobElement.querySelector('.post-title')?.textContent?.trim() || "No title",
    created_at: jobElement.querySelector('.post-title span')?.textContent?.trim() || "No date",
    salary: jobElement.querySelector('.post-title')?.childNodes[2]?.textContent?.trim().split('】')[0].slice(1) || "No salary",
    url: BASE_URL + (jobElement.getAttribute('href') || "No URL"),
  };

  const locationCategory = jobElement.querySelector('.text-muted')?.textContent?.trim() || "No location or category";
  const parts = locationCategory.split('-').map(part => part.trim());
  const location = parts[0] || "No location";
  const category = parts[1] || "No category";

  const locationParts = location.split(' ');
  jobData['1depth_region'] = locationParts[0] || "No 1depth region";
  jobData['2depth_region'] = locationParts.slice(1).join(' ') || "No 2depth region";

  jobData['1depth_category'] = category || "No 1depth category";

  return jobData;
}

function parseJobDetails(doc: Document): Record<string, string | string[] | number> {
  const details: Record<string, string | string[] | number> = {
    title: doc.querySelector('.post_title')?.textContent?.trim() || "No title",
    content: doc.querySelector('.post-detail pre')?.textContent?.trim() || "No content",
    tags: Array.from(doc.querySelectorAll('.detail-tags div')).map(tag => tag.textContent?.trim() || ""),
    contact: doc.querySelector('.post_contact a')?.textContent?.trim() || "No contact",
    language: doc.querySelector('.language')?.textContent?.trim() || "No language",
  };

  const subTitle = doc.querySelector('.post_sub_title');
  if (subTitle) {
    const spans = subTitle.querySelectorAll('span');
    if (spans.length > 0) {
      const registrationDate = spans[0].textContent?.trim() || "No date";
      const dateTimeOnly = registrationDate.replace(/^등록일:\s*/, '');
      console.log(`Registration date string: ${dateTimeOnly}`);
      details['registration_timestamp'] = convertToTimestamp(dateTimeOnly);
    }
    if (spans.length > 1) details['post_id'] = spans[1].textContent?.split(':')[1]?.trim() || "No ID";
    if (spans.length > 2) details['page_views'] = spans[2].textContent?.split(':')[1]?.trim() || "No views";
  }

  return details;
}

function convertToTimestamp(dateString: string): number {
  try {
    console.log(`Converting date string: ${dateString}`);
    const [dateStr, timeStr] = dateString.split(' ');
    
    if (!dateStr || !timeStr) {
      console.error(`Invalid date string format: ${dateString}`);
      return 0;
    }

    const [month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);

    if (isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
      console.error(`Invalid date or time components: month=${month}, day=${day}, hour=${hour}, minute=${minute}`);
      return 0;
    }

    // 현재 년도를 사용하되, 한국 시간 기준으로 설정
    const currentYear = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }).split('/')[2].split(',')[0];
    
    // JavaScript months are 0-indexed
    const date = new Date(Number(currentYear), month - 1, day, hour, minute);

    if (isNaN(date.getTime())) {
      console.error(`Invalid date created: ${date}`);
      return 0;
    }

    // 생성된 날짜가 현재 시간보다 미래인 경우, 작년으로 설정
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    if (date > now) {
      date.setFullYear(date.getFullYear() - 1);
    }

    console.log(`Converted to date: ${date.toISOString()}`);
    return date.getTime() / 1000; // 초 단위 타임스탬프 반환
  } catch (e) {
    console.error(`Error converting date to timestamp: ${e}`);
    return 0;
  }
}

function isPostedRecently(timestamp: number): boolean {
  // 타임스탬프가 초 단위인지 확인하고, 필요하다면 밀리초로 변환
  const postDate = new Date(timestamp * (timestamp > 10000000000 ? 1 : 1000));
  
  // 현재 날짜를 한국 시간으로 설정
  const koreaToday = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  const threeDaysAgo = new Date(koreaToday.getTime() - (3 * 24 * 60 * 60 * 1000));
  
  console.log(`Post date: ${postDate.toISOString()}`);
  console.log(`Korea Today: ${koreaToday.toISOString()}`);
  console.log(`Three days ago: ${threeDaysAgo.toISOString()}`);
  
  const isRecent = postDate >= threeDaysAgo && postDate <= koreaToday;
  
  console.log(`Is posted recently: ${isRecent}`);
  return isRecent;
}

async function crawlJobPostings(): Promise<void> {
  let page = 1;
  let hasNewPosts = true;
  let totalCrawledPosts = 0;
  let totalProcessedPosts = 0;

  while (hasNewPosts) {
    try {
      const url = `${BASE_URL}/1/0-0?page=${page}&per-page=30`;
      console.log(`Fetching page: ${url}`);
      const doc = await getPage(url);

      const jobPostings = [];

      // Handle top ads (if needed)
      if (page === 1) {
        const topAds = doc.querySelectorAll('.topPost a');
        console.log(`Found ${topAds.length} top ads`);
        for (const ad of topAds) {
          try {
            const adData = parseJobPosting(ad);
            const adDetails = await getJobDetails(adData.url);
            console.log(`Ad posting date: ${new Date(adDetails.registration_timestamp * 1000).toISOString()}`);
            if (isPostedToday(adDetails.registration_timestamp)) {
              jobPostings.push({ ...adData, ...adDetails, ad: true });
              console.log(`Added ad: ${adData.title}`);
            } else {
              console.log(`Skipped ad (not posted today): ${adData.title}`);
            }
          } catch (e) {
            console.error(`Error parsing top ad: ${e}`);
          }
        }
      }

      const jobElements = doc.querySelectorAll('.posts a');
      console.log(`Found ${jobElements.length} job elements on page ${page}`);
      let newPostsCount = 0;
      for (const jobElement of jobElements) {
        try {
          const jobData = parseJobPosting(jobElement);
          const jobDetails = await getJobDetails(jobData.url);
          console.log(`Job posting date: ${new Date(jobDetails.registration_timestamp * 1000).toISOString()}`);
          if (isPostedToday(jobDetails.registration_timestamp)) {
            jobPostings.push({ ...jobData, ...jobDetails, ad: false });
            newPostsCount++;
            console.log(`Added job: ${jobData.title}`);
          } else {
            console.log(`Skipped job (not posted today): ${jobData.title}`);
            hasNewPosts = false;
            break;
          }
        } catch (e) {
          console.error(`Error parsing job posting: ${e}`);
        }
      }

      totalCrawledPosts += jobElements.length;
      totalProcessedPosts += jobPostings.length;

      console.log(`Attempting to upsert ${jobPostings.length} job postings`);
      await upsertJobPostings(jobPostings);

      console.log(`Crawled page ${page}, found ${newPostsCount} new posts`);
      if (newPostsCount === 0) {
        hasNewPosts = false;
      }
      page++;
    } catch (e) {
      console.error(`Error crawling page ${page}: ${e}`);
      break;
    }
  }

  console.log(`Crawling completed. Total crawled posts: ${totalCrawledPosts}, Total processed posts: ${totalProcessedPosts}`);
}

function isPostedToday(timestamp: number): boolean {
  const postDate = new Date(timestamp * 1000);
  
  // 현재 날짜를 한국 시간으로 설정
  const koreaToday = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  
  console.log(`Post date: ${postDate.toISOString()}`);
  console.log(`Korea Today: ${koreaToday.toISOString()}`);
  
  const isToday = postDate.getFullYear() === koreaToday.getFullYear() &&
                  postDate.getMonth() === koreaToday.getMonth() &&
                  postDate.getDate() === koreaToday.getDate();
  
  console.log(`Is posted today: ${isToday}`);
  return isToday;
}

async function getJobDetails(url: string): Promise<Record<string, string | string[] | number>> {
  const doc = await getPage(url);
  return parseJobDetails(doc);
}

async function upsertJobPostings(jobDataArray: Record<string, any>[]): Promise<void> {
  const jobsToUpsert = jobDataArray.map(jobData => ({
    title: jobData.title,
    contents: jobData.content,
    "1depth_region": jobData['1depth_region'],
    "2depth_region": jobData['2depth_region'],
    "1depth_category": jobData['1depth_category'],
    "2depth_category": jobData['2depth_category'],
    ad: jobData.ad,
    created_at: new Date(jobData.registration_timestamp * 1000).toISOString(),
  }));

  console.log(`Prepared ${jobsToUpsert.length} jobs for upsert`);

  if (jobsToUpsert.length > 0) {
    for (const job of jobsToUpsert) {
      try {
        // First, check if the job already exists
        const { data: existingJob, error: selectError } = await supabase
          .from('jd')
          .select('title')
          .eq('title', job.title)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          console.error('Error checking for existing job:', selectError);
          continue;
        }

        if (existingJob) {
          // Job exists, update it
          const { data: updatedJob, error: updateError } = await supabase
            .from('jd')
            .update(job)
            .eq('title', job.title)
            .select();

          if (updateError) {
            console.error('Error updating job:', updateError);
          } else {
            console.log(`Updated job: ${job.title}`);
          }
        } else {
          // Job doesn't exist, insert it
          const { data: insertedJob, error: insertError } = await supabase
            .from('jd')
            .insert(job)
            .select();

          if (insertError) {
            console.error('Error inserting job:', insertError);
          } else {
            console.log(`Inserted new job: ${job.title}`);
          }
        }
      } catch (e) {
        console.error('Exception during job upsert:', e);
      }
    }
    console.log('Job postings upsert completed');
  } else {
    console.log('No jobs to upsert');
  }
}

Deno.serve(async (req) => {
  if (req.method === "POST") {
    try {
      console.log(`Starting crawl for today's job postings`);
      await crawlJobPostings();
      console.log('Crawling completed');
      return new Response(
        JSON.stringify({ message: "Crawling and data upsert completed" }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error", details: error.toString() }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    return new Response(
      "Please send a POST request to start crawling",
      { status: 400 }
    );
  }
})
