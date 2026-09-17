const MODEL='openrouter/free';
const MAX_NEW_SUMMARIES=5;
const summaries=new Map();
let active=0;
const waiters=[];

function acquire(){
 if(active<3){active++;return Promise.resolve();}
 return new Promise(resolve=>waiters.push(resolve));
}
function release(){
 active--;
 const next=waiters.shift();
 if(next){active++;next();}
}

async function summarize(item){
 if(!process.env.OPENROUTER_API_KEY||summaries.has(item.id)||!item.description)return;
 await acquire();
 try{
    const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':'https://yeat-tracker-three.vercel.app','X-Title':'Yeat Tracker'},body:JSON.stringify({model:MODEL,temperature:0.2,max_tokens:90,messages:[{role:'system',content:'Summarize news for a music release tracker in 1 or 2 neutral sentences. Use only the supplied text. Do not add facts, hype, or markdown.'},{role:'user',content:`Title: ${item.title}\nDescription: ${item.description}`}]})});
  if(!response.ok)return;
  const text=(await response.json()).choices?.[0]?.message?.content?.trim();
  if(text){summaries.set(item.id,text);item.summary=text;}
 }catch{}
 finally{release();}
}

export async function summarizeItems(items){
 const pending=items.filter(item=>!summaries.has(item.id)&&item.description).slice(0,MAX_NEW_SUMMARIES);
 await Promise.all(pending.map(summarize));
 for(const item of items){if(!item.summary&&summaries.has(item.id))item.summary=summaries.get(item.id);}
 return items;
}

export const summaryModel=MODEL;