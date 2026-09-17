import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarizeItems,summaryModel} from './summarize.js';

test('summarization is safely skipped without an OpenRouter key',async()=>{
 const item={id:'missing-key',title:'Yeat news',description:'A short article.'};
 const original=process.env.OPENROUTER_API_KEY;delete process.env.OPENROUTER_API_KEY;
 await summarizeItems([item]);
 assert.equal(item.summary,undefined);assert.equal(summaryModel,'openrouter/free');
 if(original)process.env.OPENROUTER_API_KEY=original;
});