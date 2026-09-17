import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import {redditMedia} from './reddit-media.js';
export const sources = [
 {id:'google',name:'Google News',url:'https://news.google.com/rss/search?q=Yeat+rapper&hl=en-US&gl=US&ceid=US:en'},
 {id:'stereogum',name:'Stereogum',url:'https://www.stereogum.com/tag/yeat/feed/'},
 {id:'pitchfork',name:'Pitchfork',url:'https://pitchfork.com/feed/feed-news/rss'},
 {id:'billboard',name:'Billboard',url:'https://www.billboard.com/feed/'},
 {id:'reddit',subreddit:'yeat_',name:'Reddit · r/yeat_',url:'https://fetchrss.com/feed/1x7Gmi04PE7O1x7GmJ4uj0mI.rss'},
];
const parser = new XMLParser({ignoreAttributes:false,processEntities:true});
export const plain = (value='') => String(typeof value === 'object' ? value['#text'] || '' : value).replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):''}).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const htmlAttribute = (tag,name) => tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
export function normalizeRedditHtml(html, source){
 const posts = [...html.matchAll(/<shreddit-post\b[^>]*>/gi)].flatMap(match=>{
  const tag=match[0];
  const title=plain(htmlAttribute(tag,'post-title')); const permalink=htmlAttribute(tag,'permalink');
  const timestamp=Date.parse(htmlAttribute(tag,'created-timestamp')); const author=plain(htmlAttribute(tag,'author'));
  if(!title || !permalink || !Number.isFinite(timestamp)) return [];
  try{
   const url=new URL(permalink,'https://www.reddit.com');
   if(url.protocol!=='https:' || !['www.reddit.com','reddit.com'].includes(url.hostname) || !url.pathname.includes('/r/'+source.subreddit+'/comments/')) return [];
   return [{id:createHash('sha256').update(url.href).digest('hex').slice(0,16),title,url:url.href,publisher:'r/'+source.subreddit,source:source.id,author:author ? '/u/'+author.replace(/^\/u\//,'') : '',publishedAt:new Date(timestamp).toISOString(),category:'Community'}];
  }catch{return []}
 });
 if(!posts.length && !/<shreddit-post\b/i.test(html)) throw new Error('Invalid Reddit HTML response');
 return posts;
}
export function normalize(xml, source){
 const document = parser.parse(xml);
 if(source.id==='reddit'){
  if(document.rss?.channel){
   let entries=document.rss.channel.item || []; if(!Array.isArray(entries)) entries=[entries];
   return entries.flatMap(entry=>{
    const url=plain(entry.link); const title=plain(entry.title); const timestamp=Date.parse(entry.pubDate);
    if(!title || !Number.isFinite(timestamp) || !url) return [];
    try {const parsed=new URL(url); if(parsed.protocol!=='https:' || !['www.reddit.com','reddit.com'].includes(parsed.hostname) || !parsed.pathname.includes('/r/'+source.subreddit+'/comments/')) return [];}catch{return []}
    return [{id:createHash('sha256').update(url).digest('hex').slice(0,16),title,url,publisher:'r/'+source.subreddit,source:source.id,author:plain(entry['dc:creator']),publishedAt:new Date(timestamp).toISOString(),category:'Community',media:redditMedia({'media:thumbnail':entry['media:content'] ? {'@_url':entry['media:content']['@_url']} : undefined,content:entry.description})}];
   });
  }
  if(!document.feed) throw new Error('Invalid Reddit feed response');
  const entries=document.feed.entry ? [].concat(document.feed.entry) : [];
  return entries.flatMap(entry=>{
   const links=[].concat(entry.link || []);
   const url=links.find(link=>link['@_rel']==='alternate')?.['@_href'] || links.find(link=>!link['@_rel'])?.['@_href'];
   const title=plain(entry.title); const timestamp=Date.parse(entry.published || entry.updated);
   if(!title || !Number.isFinite(timestamp) || !url) return [];
   try {const parsed=new URL(url); if(parsed.protocol!=='https:' || !['www.reddit.com','reddit.com'].includes(parsed.hostname)) return [];}catch{return []}
   return [{id:createHash('sha256').update(url).digest('hex').slice(0,16),title,url,publisher:'r/'+(source.subreddit || 'yeat_'),source:source.id,author:plain(entry.author?.name),publishedAt:new Date(timestamp).toISOString(),category:'Community',media:redditMedia(entry)}];
  });
 }
 if(!document.rss?.channel) throw new Error('Invalid RSS response');
 let items=document.rss.channel.item || []; if(!Array.isArray(items)) items=[items];
 return items.filter(item=>/\byeat\b/i.test(plain(item.title)+' '+plain(item.description))).flatMap(item=>{
  const url=plain(item.link); if(!/^https?:\/\//i.test(url)) return [];
  const title=plain(item.title); const timestamp=Date.parse(item.pubDate); if(!title || !Number.isFinite(timestamp)) return []; const publishedAt=new Date(timestamp).toISOString();
  const publisher=plain(item.source) || source.name;
  const cleanTitle=source.id==='google' && title.endsWith(' - '+publisher)?title.slice(0,-publisher.length-3):title;
  return [{id:createHash('sha256').update(url).digest('hex').slice(0,16),title:cleanTitle,url,publisher,publisherUrl:plain(item.source?.['@_url']) || (source.id!=='google'?url:''),source:source.id,publishedAt,category:/album|single|release|song|music|track|video|\bEP\b|five.pack/i.test(cleanTitle)?'Music':/tour|show|festival|concert/i.test(cleanTitle)?'Live':'News'}];
 });
}
// Each warm function retains independent source caches and cooldowns.
export function createFeedReader({fetcher=fetch,now=Date.now}={}){
 const states=new Map();let pending;let redditRetryAt=0;let redditFailures=0;
 async function readSource(source){
  const state=states.get(source.id)||{items:[],failures:0,nextAttempt:0};
  const metadata={id:source.id,name:source.name};
  const fallback=()=>({source:{...metadata,status:state.items.length?'stale':'unavailable',retryAt:new Date(state.nextAttempt).toISOString(),lastSuccessAt:state.lastSuccessAt,reason:state.reason},items:state.items});
  if(source.subreddit && now()<redditRetryAt){state.nextAttempt=Math.max(state.nextAttempt,redditRetryAt);state.reason='rate_limited';return fallback();}
  if(now()<state.nextAttempt)return fallback();
  try{
    let response=await fetcher(source.url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'LyfeNewsTracker/1.0 (public RSS reader)','Accept':'application/atom+xml, application/rss+xml, application/xml, text/xml'}});
    let format='xml';
    const contentType=response.headers.get('content-type') || '';
    if(source.scrapeUrl && response.status!==429 && (!response.ok || contentType.includes('html'))){
     response=await fetcher(source.scrapeUrl,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'LyfeNewsTracker/1.0 (public RSS reader)','Accept':'text/html'}});
     format='html';
    }
   if(!response.ok){
    const error=new Error('HTTP '+response.status);error.status=response.status;
    const retry=response.headers.get('retry-after');
    if(retry){const seconds=Number(retry);error.retryMs=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(retry)-now());}
    throw error;
   }
    const body=await response.text();
    const items=format==='html'?normalizeRedditHtml(body,source):normalize(body,source);
   states.set(source.id,{items,failures:0,nextAttempt:0,lastSuccessAt:new Date(now()).toISOString()});
   return {source:{...metadata,status:'ok',lastSuccessAt:new Date(now()).toISOString()},items};
  }catch(error){
   state.reason=error.status===429?'rate_limited':error.status===403?'blocked':error.name==='TimeoutError'?'timeout':'unavailable';
   if(source.subreddit && error.status===429){redditFailures++;redditRetryAt=now()+Math.max(Math.min(900000,60000*2**Math.min(redditFailures-1,4)),error.retryMs||0);}
   state.failures++;const delay=Math.min(900000,30000*2**Math.min(state.failures,5));
   state.nextAttempt=Math.max(now()+Math.max(delay,error.retryMs||0),source.subreddit?redditRetryAt:0);states.set(source.id,state);return fallback();
  }
 }
 async function run(){
  const news=Promise.all(sources.filter(s=>!s.subreddit).map(readSource));
  const reddit=await Promise.all(sources.filter(s=>s.subreddit).map(readSource));
  if(reddit.every(r=>r.source.status==='ok'))redditFailures=0;
  const results=[...await news,...reddit];
  const seen=new Set();const items=results.flatMap(r=>r.items).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(item=>{
   const key=item.category==='Community'?item.url:item.title.toLowerCase().replace(/[^a-z0-9]/g,'');if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,160);
  return {items,sources:results.map(r=>r.source),updatedAt:new Date(now()).toISOString(),stale:results.every(r=>r.source.status!=='ok')};
 }
 return ()=>{pending ||= run().finally(()=>{pending=undefined});return pending;};
}
export const getFeed=createFeedReader();
