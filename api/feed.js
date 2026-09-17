import {getFeed} from '../lib/feed.js';
let cache; let pending;
export default async function handler(req,res){
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end();}
 try{
 if(!cache || Date.now()-cache.time>30000){
 pending ||= getFeed().finally(()=>{pending=undefined});
 const data=await pending;
 cache={time:Date.now(),data};
 }
 res.setHeader('Content-Type','application/json');
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, must-revalidate');
 res.end(JSON.stringify({...cache.data,stale:cache.data.stale || Date.now()-cache.time>30000}));
 }catch{res.statusCode=503;res.end(JSON.stringify({error:'Feeds are temporarily unavailable.'}));}
}
