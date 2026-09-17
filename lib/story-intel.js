const STOP_WORDS=new Set(['the','a','an','and','for','of','to','in','on','with','from','by','as','is','new','news','yeat','his','her','this','that','about','says','said']);

export function inferCategory(title,description=''){
 const text=`${title} ${description}`.toLowerCase();
 if(/music video|official video|visualizer|video clip/.test(text))return 'Video';
 if(/feat\.?|featuring|with [a-z]|collab/.test(text))return 'Feature';
 if(/tour|concert|festival|live show|on stage/.test(text))return 'Tour';
 if(/interview|profile|talks to|speaks with/.test(text))return 'Interview';
 if(/rumou?r|alleged|reportedly|might|could/.test(text))return 'Rumor';
 if(/album|ep|five.pack|mixtape/.test(text))return 'Album';
 if(/single|song|track|release|drops|dropping|out now/.test(text))return 'Release';
 return 'News';
}

function tokens(title){return new Set(title.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(token=>token.length>2&&!STOP_WORDS.has(token)));}
function similarity(left,right){
 const a=tokens(left),b=tokens(right);if(!a.size||!b.size)return 0;
 const shared=[...a].filter(token=>b.has(token)).length;return shared/Math.min(a.size,b.size);
}
function normalizeTitle(title){return title.toLowerCase().replace(/\s+-\s+[^-]+$/,'').replace(/[^a-z0-9]+/g,' ').trim();}

export function verificationFor(sourceCount){return sourceCount>=3?'CONFIRMED':sourceCount===2?'CONFIRMED':'REPORTED';}
export function importanceFor(story){
 const text=`${story.title} ${story.description||''}`.toLowerCase();
 const official=story.sources?.some(source=>source.official)||story.official;
 const ageHours=Math.max(0,(Date.now()-Date.parse(story.publishedAt))/3600000);
 return (official?50:0)+(story.sourceCount>1?20:0)+(/new album|new ep|announces? .*album|album announcement/.test(text)?15:0)+(/new single|single announcement/.test(text)?10:0)+(ageHours<1?5:0);
}

export function clusterStories(items){
 const clusters=[];
 for(const item of items){
  const match=clusters.find(cluster=>normalizeTitle(cluster.title)===normalizeTitle(item.title)||similarity(cluster.title,item.title)>=0.67);
  if(match){match.items.push(item);match.sources.push({id:item.source,name:item.publisher,official:item.official});if(Date.parse(item.publishedAt)>Date.parse(match.publishedAt))Object.assign(match,{title:item.title,description:item.description||match.description,publishedAt:item.publishedAt,url:item.url});}
  else clusters.push({title:item.title,description:item.description,publishedAt:item.publishedAt,url:item.url,items:[item],sources:[{id:item.source,name:item.publisher,official:item.official}]});
 }
 return clusters.map(cluster=>{
  const uniqueSources=[...new Map(cluster.sources.map(source=>[source.id,source])).values()];
  const primary=cluster.items.slice().sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))[0];
  const story={...primary,title:cluster.title,description:cluster.description,sourceCount:uniqueSources.length,sources:uniqueSources,sourceNames:uniqueSources.map(source=>source.name),verification:verificationFor(uniqueSources.length),category:inferCategory(cluster.title,cluster.description),clusterSize:cluster.items.length};
  story.importance=importanceFor(story);
  return story;
 }).sort((a,b)=>b.importance-a.importance||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}

export function mentionActivity(items,now=Date.now()){
 const days=Array.from({length:7},(_,index)=>{const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-(6-index));return {date:start.toISOString().slice(0,10),count:0};});
 for(const item of items){const date=new Date(item.publishedAt).toISOString().slice(0,10);const bucket=days.find(day=>day.date===date);if(bucket)bucket.count+=item.clusterSize||1;}
 return days;
}
