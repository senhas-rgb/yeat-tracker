import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,normalizeRedditHtml} from './feed.js';
const source={id:'google',name:'Google News'};
test('RSS normalization filters unrelated items, strips markup, preserves publisher and validates links and dates',()=>{
 const xml='<rss><channel><item><title>Yeat announces music - Example</title><link>https://example.com/news</link><source url="https://example.com">Example</source><pubDate>Tue, 15 Sep 2026 12:00:00 GMT</pubDate><description><![CDATA[<b>Yeat</b>]]></description></item><item><title>Other rapper</title></item><item><title>Yeat bad link</title><link>javascript:alert(1)</link></item><item><title>Yeat bad date</title><link>https://example.com/bad</link><pubDate>invalid</pubDate></item></channel></rss>';
 const items=normalize(xml,source);assert.equal(items.length,1);assert.equal(items[0].title,'Yeat announces music');assert.equal(items[0].publisher,'Example');assert.equal(items[0].publisherUrl,'https://example.com');assert.equal(items[0].category,'Music');assert.equal(items[0].publishedAt,'2026-09-15T12:00:00.000Z');
});
test('Rejects non-RSS responses and accepts empty feeds',()=>{assert.throws(()=>normalize('<html>blocked</html>',source));assert.deepEqual(normalize('<rss><channel><title>News</title></channel></rss>',source),[])});
test('Reddit Atom keeps topic posts without requiring Yeat in every title and rejects unsafe links',()=>{
 const xml='<feed><entry><title>New snippet tonight</title><published>2026-09-17T12:00:00Z</published><updated>2026-09-17T13:00:00Z</updated><author><name>/u/fan</name></author><link rel="self" href="https://www.reddit.com/api/post"/><link rel="alternate" href="https://www.reddit.com/r/yeat_/comments/123/new/"/></entry><entry><title>Invalid</title><updated>2026-09-17T12:00:00Z</updated><link href="https://evil.example/"/></entry></feed>';
 const items=normalize(xml,{id:'reddit'});assert.equal(items.length,1);assert.equal(items[0].category,'Community');assert.equal(items[0].author,'/u/fan');assert.equal(items[0].publishedAt,'2026-09-17T12:00:00.000Z');assert.match(items[0].url,/comments/);
 assert.deepEqual(normalize('<feed><title>Empty</title></feed>',{id:'reddit'}),[]);
 assert.throws(()=>normalize('<html>Blocked</html>',{id:'reddit'}));
});
test('FetchRSS Reddit RSS keeps posts, authors, media, and safe links',()=>{
 const xml='<rss><channel><item><title>New clip</title><link>https://www.reddit.com/r/yeat_/comments/123/new/</link><dc:creator>/u/fan</dc:creator><pubDate>Thu, 17 Sep 2026 12:00:00 +0000</pubDate><description><![CDATA[<img src="https://preview.redd.it/a.jpg"/>]]></description><media:content url="https://preview.redd.it/a.jpg" medium="image"/></item><item><title>Unsafe</title><link>https://evil.example/post</link><pubDate>Thu, 17 Sep 2026 12:00:00 +0000</pubDate></item></channel></rss>';
 const items=normalize(xml,{id:'reddit',subreddit:'yeat_'});assert.equal(items.length,1);assert.equal(items[0].author,'/u/fan');assert.equal(items[0].media.kind,'image');
});
test('Reddit HTML scraper extracts public posts and rejects unsafe or incomplete cards',()=>{
 const html='<shreddit-post post-title="New clip &amp; more" permalink="/r/yeat_/comments/123/new/" created-timestamp="2026-09-17T12:00:00Z" author="fan"></shreddit-post><shreddit-post post-title="Bad" permalink="https://evil.example/post" created-timestamp="2026-09-17T12:00:00Z"></shreddit-post><shreddit-post post-title="Missing date" permalink="/r/yeat_/comments/456/missing/"></shreddit-post>';
 const items=normalizeRedditHtml(html,{id:'reddit',subreddit:'yeat_'});
 assert.equal(items.length,1);assert.equal(items[0].title,'New clip & more');assert.equal(items[0].author,'/u/fan');assert.match(items[0].url,/reddit\.com\/r\/yeat_\/comments\/123/);
 assert.throws(()=>normalizeRedditHtml('<html>blocked</html>',{id:'reddit',subreddit:'yeat_'}));
});

test('Reddit previews decode thumbnails, identify video links and reject untrusted image hosts',async()=>{
 const {redditMedia}=await import('./reddit-media.js');
 assert.deepEqual(redditMedia({'media:thumbnail':{'@_url':'https://preview.redd.it/a.jpg?width=640&amp;crop=smart'},content:'<a href="https://v.redd.it/123">video</a>'}),{thumbnail:'https://preview.redd.it/a.jpg?width=640&crop=smart',kind:'video'});
 assert.equal(redditMedia({content:'<img src="https://evil.example/pixel"/>'}),undefined);
 assert.equal(redditMedia({content:'<img src="https://i.redd.it/image.jpg"/>'}).kind,'image');
});

test('Only r/yeat_ is fetched, concurrent refreshes share work, and Retry-After preserves posts',async()=>{
 const {createFeedReader}=await import('./feed.js');let now=100000;let fail=false;const events=[];
 const reader=createFeedReader({now:()=>now,sleep:async ms=>{events.push('gap:'+ms);now+=ms},fetcher:async url=>{
    if(!url.includes('reddit.com')&&!url.includes('fetchrss.com'))return new Response('<rss><channel><title>News</title></channel></rss>');
  events.push(url.includes('fetchrss.com')?'fallback':'yeat_');
  if(fail)return new Response('',{status:429,headers:{'Retry-After':'120'}});
  return new Response('<rss><channel><item><title>New clip</title><pubDate>Thu, 17 Sep 2026 12:00:00 +0000</pubDate><link>https://www.reddit.com/r/yeat_/comments/123/clip/</link></item></channel></rss>');
 }});
 const [first,same]=await Promise.all([reader(),reader()]);assert.equal(first,same);assert.deepEqual(events,['yeat_']);assert.equal(first.items.length,1);
 fail=true;events.length=0;const failed=await reader();assert.equal(failed.items.length,1);assert.equal(failed.sources.find(s=>s.id==='reddit').status,'stale');
 events.length=0;await reader();assert.deepEqual(events,[]);
 now+=61000;events.length=0;await reader();assert.deepEqual(events,[]);
 now+=60000;events.length=0;await reader();assert.deepEqual(events,['yeat_','fallback']);
});
