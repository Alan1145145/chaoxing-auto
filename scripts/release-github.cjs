// Publish only after every updater artifact is present and verified on GitHub.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {execFileSync}=require('child_process');
const yaml=require('js-yaml');
const root=path.resolve(__dirname,'..');
const version=require('../packages/app/package.json').version;
const repo='Alan1145145/chaoxing-auto';
const output=path.resolve(root,process.argv[2]||'packages/app/dist');
const notes=process.argv[3]&&path.resolve(root,process.argv[3]);
const verifyOnly=process.argv.includes('--verify-only');
const env={...process.env,GODEBUG:'http2client=0'};
const gh=(args)=>execFileSync('gh',args,{encoding:'utf8',env,windowsHide:true,maxBuffer:8*1024*1024,timeout:15*60*1000});
const api=(endpoint)=>JSON.parse(gh(['api','repos/'+repo+'/'+endpoint]));
const hash=(file,algorithm,encoding='hex')=>crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding);
const name=`chaoxing-auto-${version}-setup-x64.exe`;
const manifest=yaml.load(fs.readFileSync(path.join(output,'latest.yml'),'utf8'));
assert.equal(manifest.version,version,'Manifest/package version mismatch');
assert.equal(manifest.files?.length,1,'Expected one Windows x64 installer');
assert.equal(manifest.files[0].url,name,'Manifest points to an unexpected installer');
const installer=path.join(output,name),digest=hash(installer,'sha512','base64');
assert.equal(manifest.files[0].sha512,digest,'Installer SHA512 mismatch');
assert.equal(manifest.sha512,digest,'Legacy manifest SHA512 mismatch');
assert.equal(manifest.files[0].size,fs.statSync(installer).size,'Installer size mismatch');
const names=[name,name+'.blockmap','latest.yml'];
const verified=names.map(name=>{const file=path.join(output,name);assert(fs.statSync(file).size>0,'Missing artifact '+name);return {name,file,size:fs.statSync(file).size,digest:'sha256:'+hash(file,'sha256')};});
if(verifyOnly){console.log(JSON.stringify({result:'PASS',version,artifacts:verified.map(({name,size,digest})=>({name,size,digest}))}));process.exit(0);}
if(!notes||!fs.statSync(notes).isFile())throw Error('Provide a release notes file as the second argument');
const target=api('git/ref/heads/main').object.sha;
const remotePackage=api('contents/packages/app/package.json?ref='+target);
assert.equal(JSON.parse(Buffer.from(remotePackage.content,'base64').toString('utf8')).version,version,'Push matching source version to main before release');
let release=api('releases?per_page=100').find(item=>item.tag_name==='v'+version);
if(release&&!release.draft)throw Error('This version is already published; increment version instead of replacing a live update');
if(!release){
 gh(['release','create','v'+version,'--repo',repo,'--target',target,'--draft','--title','超星自动机 '+version,'--notes-file',notes]);
 release=api('releases?per_page=100').find(item=>item.tag_name==='v'+version);
}
assert(release?.draft,'Expected a draft release');
assert.equal(release.target_commitish,target,'Draft belongs to another source commit');
const sums=path.join(output,'SHA256SUMS.txt');
fs.writeFileSync(sums,verified.map(item=>item.digest.slice(7)+'  '+item.name).join('\n')+'\n');
verified.push({name:'SHA256SUMS.txt',file:sums,size:fs.statSync(sums).size,digest:'sha256:'+hash(sums,'sha256')});
// Upload the manifest last. The release remains a draft until all assets match.
for(const asset of verified.filter(x=>x.name!=='latest.yml').concat(verified.filter(x=>x.name==='latest.yml'))){
 const existing=api('releases/'+release.id).assets.find(item=>item.name===asset.name);
 if(existing&&existing.state==='uploaded'&&existing.size===asset.size&&existing.digest===asset.digest){console.log('Verified '+asset.name);continue;}
 console.log('Uploading '+asset.name);
 gh(['release','upload','v'+version,asset.file,'--repo',repo,'--clobber']);
 const remote=api('releases/'+release.id).assets.find(item=>item.name===asset.name);
 assert(remote?.state==='uploaded'&&remote.size===asset.size&&remote.digest===asset.digest,'Remote artifact mismatch: '+asset.name);
}
const body=JSON.stringify({tag_name:'v'+version,target_commitish:target,draft:false,make_latest:'true'});
const published=JSON.parse(execFileSync('gh',['api','repos/'+repo+'/releases/'+release.id,'--method','PATCH','--input','-'],{input:body,encoding:'utf8',env,windowsHide:true,timeout:60000}));
assert(!published.draft&&published.tag_name==='v'+version,'Release was not published');
console.log(JSON.stringify({result:'PUBLISHED',url:published.html_url,target,artifacts:verified.length}));
