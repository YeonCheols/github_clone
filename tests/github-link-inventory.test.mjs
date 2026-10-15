import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectAriaLinks,buildInventory} from '../scripts/lib/github-link-inventory.mjs';
test('preserves link labels and regions, resolves relative links and deduplicates appearances',()=>{
 const source=[{banner:[{'button "Open global navigation menu"':null},{'link "Home"':[{ '/url':'/'}]}]},{main:[{'link "YeonCheols/github_clone"':[{ '/url':'/YeonCheols/github_clone'}]},{'link "Docs"':[{ '/url':'https://docs.github.com/'}]},{'link "Unsupported"':[{ '/url':'javascript:alert(1)'}]}]}];
 const {links,buttons}=collectAriaLinks(source);assert.equal(links.length,3);assert.deepEqual(buttons,['Open global navigation menu']);assert.equal(links[1].label,'YeonCheols/github_clone');assert.equal(links[1].region,'main');assert.equal(links[1].url,'https://github.com/YeonCheols/github_clone');assert.equal(links[2].internal,false);const inventory=buildInventory([...links,{...links[1],source:'menu'}]);assert.equal(inventory.length,3);assert.equal(inventory.find(i=>i.url.endsWith('/github_clone')).appearances.length,2);
});
