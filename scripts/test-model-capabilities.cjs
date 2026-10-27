const { app } = require('electron');
const assert = require('assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const evidence = path.resolve(__dirname, '../docs/model-browser-fixes');
app.setPath('userData', fs.mkdtempSync(path.join(evidence, 'capabilities-profile-')));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
 const bank = require('../packages/app/lib/src/services/question-bank');
 const axios = require('axios');
 const seen = [];
 const server = http.createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  seen.push({url:req.url, body, headers:req.headers});
  res.setHeader('Content-Type','application/json');
  if (req.url.startsWith('/search')) return res.end('<rss><channel><item><title>Fixture source</title><link>https://example.org/source</link><description>Verified fixture facts &amp; context</description></item></channel></rss>');
  if (req.url.includes('/reject/')) {res.statusCode=400; return res.end(JSON.stringify({error:{message:'unsupported reasoning_effort'}}));}
  if (req.url.includes('/stream/') && !body.stream) {res.statusCode=400;return res.end(JSON.stringify({error:{message:'stream must be true'}}));}
  if (body.stream) return res.end('data: {"choices":[{"delta":{"reasoning_content":"private"}}]}\n\ndata: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n');
  if(req.url.endsWith('/responses')) return res.end(JSON.stringify({output:[{type:'reasoning',content:[{text:'private'}]},{type:'message',content:[{type:'output_text',text:'OK'}]}]}));
  if(req.url.endsWith('/messages')) return res.end(JSON.stringify({content:[{type:'thinking',thinking:'private'},{type:'text',text:'OK'}]}));
  if(req.url.includes(':generateContent')) return res.end(JSON.stringify({candidates:[{content:{parts:[{thought:true,text:'private'},{text:'OK'}]}}]}));
  res.end(JSON.stringify({choices:[{message:{content:'OK',reasoning_content:'private'}}]}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const interceptor=axios.interceptors.request.use(config=>{
  if (new URL(config.url).hostname === 'www.bing.com') config.url=base+'/search';
  if(new URL(config.url).hostname!=='127.0.0.1') throw Error('Unexpected upstream');
  return config;
 });
 let assertions=0; const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
 const p={id:'cap-fixture',name:'Capabilities',model:'fixture',protocol:'openai-chat',baseUrl:base+'/v1',apiKey:'fixture-secret',enabled:true};
 try {
  await bank.testQuestionBankProvider({...p,capabilityPreset:'qwen',reasoningEnabled:true,webSearchEnabled:true});
  eq(seen.at(-1).body.enable_thinking,true); eq(seen.at(-1).body.enable_search,true);eq(seen.at(-1).body.search_options.forced_search,true);
  await bank.testQuestionBankProvider({...p,capabilityPreset:'deepseek',reasoningEnabled:true,webSearchEnabled:true});
  eq(seen.at(-1).body.thinking,{type:'enabled'});eq(seen.at(-1).body.reasoning_effort,'high');assert(seen.at(-1).body.messages[0].content.includes('https://example.org/source'));assertions++;
  await bank.testQuestionBankProvider({...p,capabilityPreset:'openai',reasoningEnabled:true,webSearchEnabled:true});
  eq(seen.at(-1).url,'/v1/responses');eq(seen.at(-1).body.tools,[{type:'web_search'}]);eq(seen.at(-1).body.tool_choice,'required');eq(seen.at(-1).body.reasoning,{effort:'high'});
  const responses=await bank.testQuestionBankProvider({...p,capabilityPreset:'openai',webSearchEnabled:true});eq(responses.response,'OK');eq(seen.at(-1).body.reasoning,undefined);
  for (const model of ['claude-sonnet-4-5','claude-sonnet-4-6','claude-opus-4-7']) {
   const result=await bank.testQuestionBankProvider({...p,protocol:'anthropic',model,reasoningEnabled:true,webSearchEnabled:true});
   eq(result.response,'OK');eq(seen.at(-1).body.thinking.type,model.endsWith('4-5')?'enabled':'adaptive');assert(seen.at(-1).body.max_tokens>4096);assertions++;eq(seen.at(-1).body.tools[0].name,'web_search');
  }
  for (const model of ['gemini-2.5-pro','gemini-3-pro-preview']) {
   eq((await bank.testQuestionBankProvider({...p,protocol:'gemini',model,reasoningEnabled:true,webSearchEnabled:true})).response,'OK');
   eq(seen.at(-1).body.generationConfig.thinkingConfig,model.includes('2.5')?{thinkingBudget:4096}:{thinkingLevel:'HIGH'});eq(seen.at(-1).body.tools,[{google_search:{}}]);
  }
  const saved=bank.saveQuestionBankConfig({providers:[{...p,reasoningEnabled:true,webSearchEnabled:true,capabilityPreset:'compatible'}],selectedProviderId:p.id,autoSaveAiAnswers:false});
  const publicProvider=bank.getQuestionBankConfig().providers.find(x=>x.id===p.id);
  eq(publicProvider.reasoningEnabled,true);eq(publicProvider.webSearchEnabled,true);eq(publicProvider.apiKey,'');eq(publicProvider.hasApiKey,true);
  eq((await bank.testQuestionBankProvider({...publicProvider,reasoningEnabled:false,webSearchEnabled:false})).response,'OK');eq(seen.at(-1).headers.authorization,'Bearer fixture-secret');eq(seen.at(-1).body.reasoning_effort,undefined);
  eq((await bank.testQuestionBankProvider({...p,baseUrl:base+'/stream',capabilityPreset:'qwen',reasoningEnabled:true,webSearchEnabled:true})).response,'OK');eq(seen.at(-1).body.enable_thinking,true);eq(seen.at(-1).body.enable_search,true);
  const count=seen.length;await assert.rejects(()=>bank.testQuestionBankProvider({...p,baseUrl:base+'/reject',reasoningEnabled:true}),/unsupported reasoning_effort/);eq(seen.length,count+1);
  // Actual encrypted storage, read amplification and write coalescing.
  const storage=require('../packages/app/lib/src/utils/embedded-storage');
  let reads=0,writes=0;
  const originalRead=fs.readFileSync,originalRename=fs.renameSync;
  fs.readFileSync=function(file,...args){if(String(file).includes('embedded-settings')) reads++;return originalRead.call(this,file,...args);};
  fs.renameSync=function(file,...args){if(String(file).includes('embedded-settings')) writes++;return originalRename.call(this,file,...args);};
  for(let i=0;i<1000;i++){storage.performEmbeddedStorage('fixture','set','key',i);eq(storage.performEmbeddedStorage('fixture','get','key'),i);}
  storage.flushEmbeddedStorage();eq(writes,1);eq(reads,0);
  eq(storage.performEmbeddedStorage('other','get','key'),undefined);
  storage.performEmbeddedStorage('fixture','delete','key');eq(storage.performEmbeddedStorage('fixture','get','key'),undefined);eq(storage.performEmbeddedStorage('fixture','keys',''),[]);
  storage.flushEmbeddedStorage();eq(writes,2);
  const {decryptRenderString}=require('../packages/app/lib/src/crypto');
  const persisted=JSON.parse(decryptRenderString(originalRead(path.join(app.getPath('userData'),'embedded-settings/fixture.json'),'utf8')));eq(persisted.key,{__ocsDeleted:true});
  fs.readFileSync=originalRead;fs.renameSync=originalRename;
  const baselineFile=path.resolve(__dirname,'../packages/app/dist-model-sync-20261027/win-unpacked/resources/app/lib/src/utils/embedded-storage.js');
  let baselineReads=null,baselineWrites=null;
  if(fs.existsSync(baselineFile)) {
  const baseline=require(baselineFile);
  baselineReads=0;baselineWrites=0;
  fs.readFileSync=function(file,...args){if(String(file).includes('embedded-settings')) baselineReads++;return originalRead.call(this,file,...args);};
  fs.renameSync=function(file,...args){if(String(file).includes('embedded-settings')) baselineWrites++;return originalRename.call(this,file,...args);};
  for(let i=0;i<1000;i++){baseline.performEmbeddedStorage('baseline','set','key',i);baseline.performEmbeddedStorage('baseline','get','key');}
  fs.readFileSync=originalRead;fs.renameSync=originalRename;
  eq(baselineWrites,1000);eq(baselineReads,1999);
  }
  const report={result:'PASS',assertions,requests:seen.length,storage:{operations:2000,diskReads:reads,diskWrites:writes,baselineReads,baselineWrites}};
  fs.writeFileSync(path.join(evidence,'capabilities-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } finally {axios.interceptors.request.eject(interceptor);server.closeAllConnections();server.close();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
