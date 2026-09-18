import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clusterStories,inferCategory,mentionActivity} from './story-intel.js';

test('clusters matching headlines and verifies multi-source stories',()=>{
 const items=clusterStories([
  {id:'a',title:'Yeat announces COCOON',description:'New album news',url:'https://a.test',publisher:'Google News',source:'google',publishedAt:'2026-09-18T12:00:00Z'},
  {id:'b',title:'Yeat announces COCOON album',description:'More details',url:'https://b.test',publisher:'Billboard',source:'billboard',publishedAt:'2026-09-18T11:00:00Z'}
 ]);
 assert.equal(items.length,1);assert.equal(items[0].sourceCount,2);assert.equal(items[0].verification,'MULTIPLE OUTLETS REPORTING');
});

test('infers requested categories',()=>{
 assert.equal(inferCategory('Yeat feat. Drake',''),'Feature');
 assert.equal(inferCategory('Yeat announces new album',''),'Album');
 assert.equal(inferCategory('Yeat music video',''),'Video');
});

test('builds seven daily mention buckets',()=>{
 const activity=mentionActivity([{publishedAt:new Date(2026,8,18,12).toISOString(),clusterSize:3}],new Date(2026,8,18,20).getTime());
 assert.equal(activity.length,7);assert.equal(activity.at(-1).count,3);
});


test('counts publishers rather than feed providers',()=>{
 const base={title:'Yeat announces COCOON',description:'New album',publishedAt:'2026-09-18T12:00:00Z'};
 const cluster=rows=>clusterStories(rows.map((row,index)=>({...base,...row,id:String(index),url:`https://example.com/${index}`})))[0];
 const duplicate=cluster([{source:'google',publisher:'Billboard'},{source:'billboard',publisher:'Billboard'}]);
 assert.equal(duplicate.sourceCount,1);
 assert.equal(duplicate.verification,'REPORTED');
 const distinct=cluster([{source:'google',publisher:'Billboard'},{source:'google',publisher:'Pitchfork'}]);
 assert.equal(distinct.sourceCount,2);
 assert.deepEqual(distinct.sourceNames,['Billboard','Pitchfork']);
});

test('interviews and ordinary words do not become music features or EPs',()=>{
 assert.equal(inferCategory('Yeat interview with Zane Lowe'),'Interview');
 assert.equal(inferCategory('Yeat spotted with friends'),'News');
 assert.equal(inferCategory('Yeat September news'),'News');
 assert.equal(inferCategory('Yeat releases EP'),'Album');
});

test('mention buckets use local calendar dates across midnight',()=>{
 const previous=process.env.TZ;
 process.env.TZ='Asia/Colombo';
 try{
  const activity=mentionActivity([
   {publishedAt:'2026-09-18T12:00:00Z',clusterSize:3},
   {publishedAt:'2026-09-17T20:00:00Z',clusterSize:2},
   {publishedAt:'2026-09-17T17:00:00Z',clusterSize:1}
  ],Date.parse('2026-09-18T20:00:00+05:30'));
  assert.equal(activity.at(-1).date,'2026-09-18');
  assert.equal(activity.at(-1).count,5);
  assert.equal(activity.at(-2).count,1);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
