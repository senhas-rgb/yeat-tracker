// Read only known Reddit image hosts; never render feed HTML.
const decode = value => String(value || '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function imageUrl(value){
 try{const url=new URL(decode(value));return url.protocol==='https:' && ['i.redd.it','preview.redd.it','external-preview.redd.it','i.redditmedia.com','b.thumbs.redditmedia.com','a.thumbs.redditmedia.com'].includes(url.hostname)?url.href:null;}catch{return null;}
}
export function redditMedia(entry){
 const content=decode(typeof entry.content==='object'?entry.content['#text']:entry.content);
 const candidates=[...[].concat(entry['media:thumbnail']||[]).map(t=>t['@_url']),...Array.from(content.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),m=>m[1])];
 const image=candidates.map(imageUrl).find(Boolean);
 if(!image)return undefined;
 const video=/https?:\/\/(?:v\.redd\.it|(?:www\.)?youtube\.com|youtu\.be)\//i.test(content);
 return {thumbnail:image,kind:video?'video':'image'};
}
