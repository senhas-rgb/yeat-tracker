import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReleases} from './releases.js';

test('normalizes and sorts iTunes song releases newest first',()=>{
 const items=normalizeReleases({results:[
  {wrapperType:'track',kind:'song',trackId:2,trackName:'New Song',artistName:'Yeat',collectionName:'New Album',releaseDate:'2024-01-01T00:00:00Z',trackViewUrl:'https://music.apple.com/new'},
  {wrapperType:'collection',collectionName:'Ignored',releaseDate:'2020-01-01T00:00:00Z'},
  {wrapperType:'track',kind:'song',trackId:1,trackName:'Old Song',artistName:'Yeat',releaseDate:'2020-01-01T00:00:00Z',trackViewUrl:'https://music.apple.com/old'}
 ]});
 assert.deepEqual(items.map(item=>item.title),['New Song','Old Song']);
});