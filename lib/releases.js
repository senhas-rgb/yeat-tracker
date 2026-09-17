import {createHash} from 'node:crypto';

export function normalizeReleases(payload){
 const results=Array.isArray(payload?.results)?payload.results:[];
 return results.filter(item=>item.wrapperType==='track'&&item.kind==='song'&&item.trackName&&item.releaseDate).map(item=>({
  id:createHash('sha256').update(String(item.trackId || item.trackName)).digest('hex').slice(0,16),
  title:item.trackName,
  artist:item.artistName || 'Yeat',
  album:item.collectionName || 'Single',
  releaseDate:new Date(item.releaseDate).toISOString(),
  url:item.trackViewUrl || item.collectionViewUrl || 'https://music.apple.com/',
  artwork:item.artworkUrl100?.replace('100x100','300x300') || ''
 })).filter(item=>Number.isFinite(Date.parse(item.releaseDate))).sort((a,b)=>Date.parse(b.releaseDate)-Date.parse(a.releaseDate));
}