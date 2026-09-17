import {normalizeReleases} from '../lib/releases.js';

const CACHE_MS=900000;
let cache;
let pending;

async function getReleases(){
 if(cache&&Date.now()-cache.time<CACHE_MS)return cache.data;
 pending ||= (async()=>{
  const search=await fetch('https://itunes.apple.com/search?term=Yeat&entity=musicArtist&limit=10');
  if(!search.ok)throw new Error('Artist lookup failed');
  const artists=(await search.json()).results || [];
  const artist=artists.find(item=>item.artistName?.toLowerCase()==='yeat') || artists[0];
  if(!artist?.artistId)throw new Error('Yeat artist not found');
  const response=await fetch(`https://itunes.apple.com/lookup?id=${artist.artistId}&entity=song&limit=200`);
  if(!response.ok)throw new Error('Release lookup failed');
  const data={items:normalizeReleases(await response.json()),updatedAt:new Date().toISOString()};
  cache={time:Date.now(),data};
  return data;
 })().finally(()=>{pending=undefined});
 return pending;
}

export default async function handler(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end();}
 try{
  const data=await getReleases();
  res.setHeader('Content-Type','application/json');
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=900, stale-while-revalidate=1800');
  res.end(JSON.stringify(data));
 }catch{res.statusCode=503;res.end(JSON.stringify({error:'Release timeline is temporarily unavailable.'}));}
}