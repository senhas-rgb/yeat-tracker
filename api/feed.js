import {getFeed} from '../lib/feed.js';
import {checkOfficialSite} from '../lib/official-site.js';
const CACHE_MS=300000;
let cache; let pending;
export default async function handler(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end();}
 try{
 if(!cache || Date.now()-cache.time>CACHE_MS){
 pending ||= getFeed().finally(()=>{pending=undefined});
	const data=await pending;
	data.officialSite=await checkOfficialSite();
 cache={time:Date.now(),data};
 }
 res.setHeader('Content-Type','application/json');
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=300, stale-while-revalidate=600');
 res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
 res.end(JSON.stringify({...cache.data,stale:cache.data.stale || Date.now()-cache.time>CACHE_MS}));
 }catch{res.statusCode=503;res.end(JSON.stringify({error:'Feeds are temporarily unavailable.'}));}
}
