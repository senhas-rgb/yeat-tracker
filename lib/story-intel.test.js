import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clusterStories,inferCategory,mentionActivity} from './story-intel.js';

test('clusters matching headlines and verifies multi-source stories',()=>{
 const items=clusterStories([
  {id:'a',title:'Yeat announces COCOON',description:'New album news',url:'https://a.test',publisher:'Google News',source:'google',publishedAt:'2026-09-18T12:00:00Z'},
  {id:'b',title:'Yeat announces COCOON album',description:'More details',url:'https://b.test',publisher:'Billboard',source:'billboard',publishedAt:'2026-09-18T11:00:00Z'}
 ]);
 assert.equal(items.length,1);assert.equal(items[0].sourceCount,2);assert.equal(items[0].verification,'CONFIRMED');
});

test('infers requested categories',()=>{
 assert.equal(inferCategory('Yeat feat. Drake',''),'Feature');
 assert.equal(inferCategory('Yeat announces new album',''),'Album');
 assert.equal(inferCategory('Yeat music video',''),'Video');
});

test('builds seven daily mention buckets',()=>{
 const activity=mentionActivity([{publishedAt:'2026-09-18T12:00:00Z',clusterSize:3}],Date.parse('2026-09-18T20:00:00Z'));
 assert.equal(activity.length,7);assert.equal(activity.at(-1).count,3);
});
