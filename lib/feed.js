import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
export const sources = [
 {id:'google',name:'Google News',url:'https://news.google.com/rss/search?q=Yeat+rapper&hl=en-US&gl=US&ceid=US:en'},
 {id:'stereogum',name:'Stereogum',url:'https://www.stereogum.com/tag/yeat/feed/'},
 {id:'pitchfork',name:'Pitchfork',url:'https://pitchfork.com/feed/feed-news/rss'},
 {id:'billboard',name:'Billboard',url:'https://www.billboard.com/feed/'},
];
const parser = new XMLParser({ignoreAttributes:false,processEntities:true});
export const plain = (value='') => String(typeof value === 'object' ? value['#text'] || '' : value).replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):''}).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
export function normalize(xml, source){
 const document = parser.parse(xml);
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
 const states=new Map();let pending;
 async function readSource(source){
  const state=states.get(source.id)||{items:[],failures:0,nextAttempt:0};
  const metadata={id:source.id,name:source.name};
  const fallback=()=>({source:{...metadata,status:state.items.length?'stale':'unavailable',retryAt:new Date(state.nextAttempt).toISOString(),lastSuccessAt:state.lastSuccessAt,reason:state.reason},items:state.items});
  if(now()<state.nextAttempt)return fallback();
  try{
  const response=await fetcher(source.url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'YeatTracker/1.0','Accept':'application/rss+xml, application/xml, text/xml'}});
   if(!response.ok){
    const error=new Error('HTTP '+response.status);error.status=response.status;
    const retry=response.headers.get('retry-after');
    if(retry){const seconds=Number(retry);error.retryMs=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(retry)-now());}
    throw error;
   }
    const body=await response.text();
    const items=normalize(body,source);
   states.set(source.id,{items,failures:0,nextAttempt:0,lastSuccessAt:new Date(now()).toISOString()});
   return {source:{...metadata,status:'ok',lastSuccessAt:new Date(now()).toISOString()},items};
  }catch(error){
   state.reason=error.status===429?'rate_limited':error.status===403?'blocked':error.name==='TimeoutError'?'timeout':'unavailable';
   state.failures++;const delay=Math.min(900000,30000*2**Math.min(state.failures,5));
  state.nextAttempt=Math.max(now()+Math.max(delay,error.retryMs||0),0);states.set(source.id,state);return fallback();
  }
 }
 async function run(){
  const results=await Promise.all(sources.map(readSource));
  const seen=new Set();const items=results.flatMap(r=>r.items).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(item=>{
  const key=item.url || item.title.toLowerCase().replace(/[^a-z0-9]/g,'');if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,160);
  return {items,sources:results.map(r=>r.source),updatedAt:new Date(now()).toISOString(),stale:results.every(r=>r.source.status!=='ok')};
 }
 return ()=>{pending ||= run().finally(()=>{pending=undefined});return pending;};
}
export const getFeed=createFeedReader();
