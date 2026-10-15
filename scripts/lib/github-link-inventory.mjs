export function collectAriaLinks(tree,{source='home',pageUrl='https://github.com/'}={}){
 const links=[],buttons=new Set();
 const labelOf=role=>{const match=role.match(/^(?:link|button)\s+"((?:[^"\\]|\\.)*)"/);if(!match)return role;try{return JSON.parse('"'+match[1]+'"')}catch{return match[1]}};
 function walk(node,ancestors=[]){
  if(Array.isArray(node)){for(const child of node)walk(child,ancestors);return}
  if(typeof node==='string'){if(/^button\b/.test(node))buttons.add(labelOf(node));return}
  if(!node||typeof node!=='object')return;
  for(const [role,value]of Object.entries(node)){
   if(role==='/url'&&typeof value==='string'){
    const anchor=[...ancestors].reverse().find(s=>/^(?:link|menuitem)\b/.test(s));if(!anchor)continue;
    try{const u=new URL(value,pageUrl);if(!['https:','http:'].includes(u.protocol))continue;u.username='';u.password='';links.push({url:u.href,label:labelOf(anchor),source,region:ancestors.filter(s=>/^(?:banner|navigation|main|complementary|contentinfo|menu|dialog|heading)\b/.test(s)).join(' > ')||'page',internal:u.origin==='https://github.com'})}catch{}
   }else{if(/^button\b/.test(role))buttons.add(labelOf(role));walk(value,[...ancestors,role])}
  }
 }
 walk(tree);return {links,buttons:[...buttons]};
}
export function buildInventory(observations){
 const unique=new Map();
 for(const item of observations){const record=unique.get(item.url)||{url:item.url,internal:item.internal,labels:[],appearances:[]};if(!record.labels.includes(item.label))record.labels.push(item.label);record.appearances.push({source:item.source,region:item.region});unique.set(item.url,record)}
 return [...unique.values()].sort((a,b)=>a.url.localeCompare(b.url));
}
