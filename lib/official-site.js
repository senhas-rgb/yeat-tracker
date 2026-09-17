import {createHash} from 'node:crypto';

let previous;
const SITE_URL='https://www.yeatofficial.com/';

export async function checkOfficialSite(fetcher=fetch){
 try{
  const response=await fetcher(SITE_URL,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'YeatTracker/1.0','Accept':'text/html'}});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const html=await response.text();
  const important=html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').match(/<(?:a|nav|main|header|footer)[^>]*>[\s\S]*?<\/(?:a|nav|main|header|footer)>/gi)?.join('')||html;
  const hash=createHash('sha256').update(important).digest('hex');
  const changed=Boolean(previous&&previous.hash!==hash);
  const result={url:SITE_URL,status:'ok',hash,changed,lastCheckedAt:new Date().toISOString(),changedAt:changed?new Date().toISOString():previous?.changedAt};
  previous=result;
  return result;
 }catch(error){return {url:SITE_URL,status:'unavailable',error:error.message,lastCheckedAt:new Date().toISOString(),changed:false};}
}
