import {test} from 'node:test';import assert from 'node:assert/strict';
import {profilePageRoute} from '../src/profile-route.mjs';
import {readProfile,profileRepositories} from '../server/profile.mjs';
import {ApiError} from '../server/api-error.mjs';
test('profile routes do not swallow repositories, unsupported tabs or unsupported settings',()=>{
 assert.deepEqual(profilePageRoute('/YeonCheols?tab=stars'),{kind:'profile',tab:'stars',title:'YeonCheols'});
 assert.equal(profilePageRoute('/settings/profile').kind,'settings');assert.equal(profilePageRoute('/settings/appearance'),null);assert.equal(profilePageRoute('/YeonCheols/github_clone'),null);assert.equal(profilePageRoute('/YeonCheols?tab=projects'),null);assert.equal(profilePageRoute('/other'),null);
});
test('profile reading retains optional section failures without fabricating contribution data',async()=>{
 const result=await readProfile(async endpoint=>{if(endpoint.startsWith('users/'))return {data:{login:'YeonCheols',email:'private',plan:'secret'}};if(endpoint.includes('/readme'))throw new ApiError(404,'Absent');throw new ApiError(403,'Denied')},{login:'YeonCheols'});
 assert.equal(result.profile.login,'YeonCheols');assert.equal(result.profile.email,undefined);assert.equal(result.readme,'');assert.equal(result.readmeUnavailable,false);assert.equal(result.overview,null);
});
test('profile repositories use account endpoints and expose page-filtering limits without leaking clone tokens',async()=>{
 const calls=[];const request=async endpoint=>{calls.push(endpoint);return {data:[{id:1,full_name:'YeonCheols/repo',private:true,language:'JavaScript',temp_clone_token:'private'}],next:true}};
 const result=await profileRepositories(request,new URLSearchParams('tab=repositories&page=2&type=private&q=repo'));
 assert.match(calls[0],/^user\/repos\?affiliation=owner/);assert.match(calls[0],/page=2/);assert.equal(result.items.length,1);assert.equal(result.items[0].temp_clone_token,undefined);assert.equal(result.filteredPage,true);assert.equal(result.next,true);
 await profileRepositories(request,new URLSearchParams('tab=stars&sort=created'));assert.match(calls[1],/^user\/starred\?sort=created/);
 await assert.rejects(profileRepositories(request,new URLSearchParams('page=-1')),/필터/);
});
