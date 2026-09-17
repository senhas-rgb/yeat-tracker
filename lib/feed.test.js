import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,createFeedReader,sources} from './feed.js';

test('Only news sources are configured',()=>{
 assert.deepEqual(sources.map(source=>source.id),['google','stereogum','pitchfork','billboard']);
});

test('RSS normalization filters unrelated items and preserves publisher data',()=>{
 const xml='<rss><channel><item><title>Yeat announces music - Example</title><link>https://example.com/news</link><source url="https://example.com">Example</source><pubDate>Tue, 15 Sep 2026 12:00:00 GMT</pubDate><description><![CDATA[<b>Yeat</b>]]></description></item><item><title>Other rapper</title></item></channel></rss>';
 const items=normalize(xml,{id:'google',name:'Google News'});
 assert.equal(items.length,1);assert.equal(items[0].title,'Yeat announces music');assert.equal(items[0].publisher,'Example');assert.equal(items[0].description,'Yeat');
});

test('Concurrent feed refreshes share work',async()=>{
 let calls=0;const reader=createFeedReader({fetcher:async()=>{calls++;return new Response('<rss><channel/></rss>')}});
 const [first,same]=await Promise.all([reader(),reader()]);assert.equal(first,same);assert.equal(calls,4);
});
