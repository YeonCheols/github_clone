import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=spawn(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.kill(signal));
server.once('error',error=>{console.error(error.message);process.exitCode=1});
server.once('close',code=>{process.exitCode=code??1});
