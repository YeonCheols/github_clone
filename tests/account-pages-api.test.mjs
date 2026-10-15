import {test} from 'node:test';import assert from 'node:assert/strict';
import {accountRepositories,accountItems,pullInbox} from '../server/account-pages.mjs';
const repo={id:'repo-id',nameWithOwner:'YeonCheols/github_clone',url:'https://github.com/YeonCheols/github_clone',isPrivate:false,description:'Clone',isFork:false,isArchived:false,hasIssuesEnabled:true,viewerPermission:'ADMIN',viewerHasStarred:false,updatedAt:'2026-10-15T00:00:00Z',forkCount:0,stargazerCount:0,primaryLanguage:{name:'JavaScript',color:'#f1e05a'},licenseInfo:null,issues:{totalCount:1},pullRequests:{totalCount:0},owner:{login:'YeonCheols',avatarUrl:'avatar'}};
test('repository collection uses a fixed read-only query, cursor variables and filtered metadata',async()=>{
 const calls=[];const request=async(...args)=>{calls.push(args);return {data:{data:{viewer:{result:{nodes:[repo,{...repo,nameWithOwner:'Other/repo',viewerPermission:'READ'}],totalCount:2,pageInfo:{hasNextPage:true,endCursor:'next'}}}}}}};
 const value=await accountRepositories(request,new URLSearchParams('view=admin&q=github&after=opaque&sort=stars'));
 assert.equal(value.items.length,1);assert.equal(value.items[0].can_open_issue,true);assert.equal(value.items[0].full_name,'YeonCheols/github_clone');assert.equal(value.filteredPage,true);assert.equal(value.cursor,'next');assert.equal(calls[0][0],'graphql');assert.match(calls[0][2].query,/query AccountRepositories/);assert.doesNotMatch(calls[0][2].query,/mutation/);assert.deepEqual(calls[0][2].variables,{after:'opaque'});
 await assert.rejects(accountRepositories(request,new URLSearchParams('view=other')),/필터/);
});
test('account issue search resolves @me, reinforces type/state and retains state totals',async()=>{
 const calls=[];const request=async(endpoint,method,body)=>{calls.push({endpoint,method,body});if(endpoint==='graphql')return {data:{data:{open:{issueCount:1},closed:{issueCount:3}}}};return {data:{items:[{id:1,title:'Live issue',number:9,user:{login:'YeonCheols'},labels:[],html_url:'https://github.com/YeonCheols/github_clone/issues/9'}],total_count:3},next:false}};
 const result=await accountItems(request,{login:'YeonCheols'},new URLSearchParams('kind=issue&view=created&state=closed&q=is:pr%20state:open%20fix%20mentions:@me'));
 const query=decodeURIComponent(calls.find(c=>c.endpoint.startsWith('search/')).endpoint);assert.match(query,/is:issue state:closed author:YeonCheols/);assert.match(query,/mentions:YeonCheols/);assert.doesNotMatch(query,/is:pr|state:open/);assert.deepEqual(result.counts,{open:1,closed:3});assert.equal(result.items[0].number,9);
 await assert.rejects(accountItems(request,{login:'YeonCheols'},new URLSearchParams('page=99')),/페이지/);
});
test('PR inbox preserves unknown team coverage and scopes a selected repository without a mutation',async()=>{
 let captured;
 const result=await pullInbox(async(endpoint,method,body)=>{captured=body;return {data:{data:Object.fromEntries(['review','drafts','waiting','action','ready'].map(id=>[id,{issueCount:0,nodes:[]}]))}}},{login:'YeonCheols'},new URLSearchParams('repo=YeonCheols/github_clone&days=90'));
 assert.match(captured.query,/repo:YeonCheols\/github_clone/);assert.doesNotMatch(captured.query,/mutation/);assert.equal(result.groups.length,5);assert.equal(result.groups[0].total,0);assert.ok(result.limitations.length);
 await assert.rejects(pullInbox(async()=>{}, {login:'YeonCheols'},new URLSearchParams('repo=../private')),/형식/);
});
