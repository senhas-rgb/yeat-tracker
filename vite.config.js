import { defineConfig } from 'vite';
import handler from './api/feed.js';
export default defineConfig({plugins:[{name:'local-feed',configureServer(server){server.middlewares.use('/api/feed',handler)},configurePreviewServer(server){server.middlewares.use('/api/feed',handler)}}]});
