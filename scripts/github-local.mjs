import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(import.meta.url);
const root=resolve(dirname(script),'..');
const command=process.argv[2];
if(!command||command==='--help'){
 console.log('Repository-only GitHub authentication.');
 console.log('node scripts/github-local.mjs login [--push]');
 console.log('node scripts/github-local.mjs status');
 console.log('node scripts/github-local.mjs push');
 console.log('Credentials: .git/gh-local (private local files; no system keychain or global credential changes).');
 process.exit(0);
}
const gh=process.env.GITHUB_LOCAL_GH_BIN||'/opt/homebrew/bin/gh';
function git(args,options={}){
 const r=spawnSync('git',args,{cwd:root,encoding:'utf8',...options});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error(r.stderr||`git exited ${r.status}`);
 return (r.stdout||'').trim();
}
const authRoot=join(git(['rev-parse','--absolute-git-dir']),'gh-local');
const environment={...process.env,GH_CONFIG_DIR:authRoot};
for(const key of ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN'])delete environment[key];
// Keep all gh configuration inside the Git directory, including XDG fallbacks.
environment.XDG_CONFIG_HOME=authRoot;
async function runGh(args,{capture=false,input}={}){
 if(capture){
  const result=spawnSync(gh,args,{cwd:root,env:environment,encoding:'utf8',stdio:['ignore','pipe','inherit']});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`gh exited ${result.status}`);
  return result.stdout.trim();
 }
 return new Promise((yes,no)=>{
  const child=spawn(gh,args,{cwd:root,env:environment,stdio:[input===undefined?'inherit':'pipe','inherit','inherit']});
  child.once('error',no);child.once('close',code=>code===0?yes():no(new Error(`gh exited ${code}`)));
  if(input!==undefined)child.stdin.end(input);
 });
}
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
async function verifyAccount(){
 const account=await runGh(['api','user','--jq','.login'],{capture:true});
 if(account.toLowerCase()!=='yeoncheols')throw new Error(`Expected YeonCheols; signed in as ${account}. No push performed.`);
 return account;
}
function localGitCredentials(){
 // Empty first entry resets inherited helpers only inside this repository.
 const key='credential.https://github.com.helper';
 git(['config','--local','--replace-all',key,'']);
 git(['config','--local','--add',key,`!${quote(process.execPath)} ${quote(script)} credential`]);
 git(['config','--local','credential.https://github.com.username','YeonCheols']);
 git(['config','--local','credential.https://github.com.useHttpPath','true']);
}
async function push(){
 await verifyAccount();
 const canPush=await runGh(['api','repos/YeonCheols/github_clone','--jq','.permissions.push'],{capture:true});
 if(canPush!=='true')throw new Error('Repository write permission is unavailable.');
 const remote=git(['remote','get-url','origin']);
 if(remote!=='https://github.com/YeonCheols/github_clone.git')throw new Error('Unexpected origin; no push performed.');
 localGitCredentials();
 const status=spawnSync('git',['push','origin','master'],{cwd:root,env:environment,stdio:'inherit'});
 if(status.error)throw status.error;
 if(status.status!==0)throw new Error(`git push exited ${status.status}`);
 console.log('Pushed origin/master using repository-local authentication.');
}
try{
 if(command==='credential'){
  // Git passes get/store/erase and the request on stdin. Avoid logging it.
  const status=await new Promise((yes,no)=>{
   const child=spawn(gh,['auth','git-credential',...process.argv.slice(3)],{cwd:root,env:environment,stdio:'inherit'});
   child.once('error',no);child.once('close',yes);
  });
  process.exitCode=status??1;
 }else if(command==='login'){
  mkdirSync(authRoot,{recursive:true,mode:0o700});chmodSync(authRoot,0o700);
  console.log('Sign in as YeonCheols in the browser. Credentials stay inside this repository.');
  console.log('The token is stored in a private file inside .git; the system keychain is not used.');
  // Piped stdin disables interactive global Git-helper setup; n also refuses it
  // if this CLI version asks. Authentication uses the browser device flow.
  await runGh(['auth','login','--hostname','github.com','--git-protocol','https','--web','--insecure-storage'],{input:'n\n'});
  await verifyAccount();
  for(const name of ['hosts.yml','config.yml']){
   try{chmodSync(join(authRoot,name),0o600);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  localGitCredentials();
  console.log('Repository-local authentication configured.');
  if(process.argv.includes('--push'))await push();
 }else if(command==='status'){
  await runGh(['auth','status']);
 }else if(command==='push'){
  await push();
 }else throw new Error('Unknown command. Use --help.');
}catch(error){console.error(error.message);process.exitCode=1;}
