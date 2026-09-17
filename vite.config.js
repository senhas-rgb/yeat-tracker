import { defineConfig,loadEnv } from 'vite';
import handler from './api/feed.js';
import releasesHandler from './api/releases.js';
export default defineConfig(({mode})=>{Object.assign(process.env,loadEnv(mode,process.cwd(),''));return {plugins:[{name:'local-feed',configureServer(server){server.middlewares.use('/api/feed',handler);server.middlewares.use('/api/releases',releasesHandler)},configurePreviewServer(server){server.middlewares.use('/api/feed',handler);server.middlewares.use('/api/releases',releasesHandler)}}]}});
