const reserved=new Set(['issues','pulls','repos','settings','notifications','feed','copilot','dashboard','home','projects','discussions','codespaces','explore','marketplace','mcp','organizations','sponsors','search','login','logout','new','features','enterprise','pricing','security']);
export function repositoryRoute(route){
 const path=route.split(/[?#]/,1)[0],parts=path.split('/').filter(Boolean);
 if(parts.length<2||reserved.has(parts[0].toLowerCase()))return null;
 let owner,name;try{owner=decodeURIComponent(parts[0]);name=decodeURIComponent(parts[1])}catch{return null}
 if(!/^[a-z0-9][a-z0-9-]{0,38}$/i.test(owner)||! /^(?!\.{1,2}$)[a-z0-9_.-]{1,100}$/i.test(name))return null;
 const suffix=parts.slice(2).join('/');
 const supported=!suffix||suffix==='issues'||/^issues\/\d+$/.test(suffix)||/^(?:blob|tree)\/[^/]+\/.+/.test(suffix);
 return {owner,name,slug:owner+'/'+name,base:'/'+owner+'/'+name,supported};
}
