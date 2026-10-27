const {_electron:electron}=require('playwright-core');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const evidence=path.resolve(__dirname,'../docs/model-browser-fixes');
 const profile=fs.mkdtempSync(path.join(evidence,'audit-ui-profile-'));
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({version:'0.0.0',render:{state:{first:false,setup:false,newBrowserSetup:false},notifies:[{id:'chaoxing-auto-tutorial-1.0.0',content:[]}]}}));
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'model-test-bootstrap.cjs')],cwd:path.resolve(__dirname,'../packages/app'),env:{...process.env,MODEL_TEST_PROFILE:profile}});
 const results=[];
 const check=(ok,name,detail)=>results.push({name,ok:!!ok,...(detail?{detail}: {})});
 try {
  const page=await app.firstWindow();await page.waitForSelector('.app-navigation');
  await app.evaluate(()=>globalThis.__modelTest.openCourse());
  await page.waitForTimeout(1000);
  await app.evaluate(()=>globalThis.__modelTest.course.webContents.executeJavaScript("GM_setValue('audit.mutable',[]);const value=GM_getValue('audit.mutable');value.push('persisted');GM_setValue('audit.mutable',value)"));
  const saved=await app.evaluate(()=>{
   const storage=globalThis.__modelTest.modules.storage;
   return storage.performEmbeddedStorage('model-sync-fixture','snapshot','');
  });
  const entry=Object.entries(saved).find(([key])=>key.endsWith('audit.mutable'))?.[1];
  check(JSON.stringify(entry)==='["persisted"]','Mutable GM value persisted',entry);
  const isolated=await app.evaluate(()=>globalThis.__modelTest.course.webContents.executeJavaScript("const original={nested:{value:1}};GM_setValue('audit.detached',original);original.nested.value=2;GM_getValue('audit.detached').nested.value===1"));
  check(isolated,'GM_setValue detaches caller objects');
  await app.evaluate(({ipcMain})=>{
   const bank=globalThis.__modelTest.modules.bank;
   bank.saveQuestionBankConfig({providers:[...bank.getQuestionBankConfig().providers.filter(p=>p.id==='builtin-doubao'),{id:'audit',name:'审查模型',baseUrl:'http://127.0.0.1:15329',protocol:'openai-chat',model:'audit-model',enabled:true}],selectedProviderId:'builtin-doubao',autoSaveAiAnswers:true});
   globalThis.__auditBank=bank;globalThis.__auditFail='';
   const originals=ipcMain.listeners('methods-call');ipcMain.removeAllListeners('methods-call');
   ipcMain.on('methods-call',(event,args)=>{
    const failure=globalThis.__auditFail;
    if((failure==='ocs'&&args[1]==='saveStore')||(failure==='model'&&args[1]==='saveQuestionBankConfig')){
     globalThis.__auditFail='';event.sender.send(args[0],{error:'audit injected persistence failure'});return;
    }
    for(const handler of originals) handler(event,args);
   });
  });
  await page.getByRole('button',{name:'模型接入',exact:true}).click();
  await page.locator('.provider-card').filter({hasText:'审查模型'}).waitFor();
  await app.evaluate(()=>globalThis.__auditFail='ocs');
  await page.locator('.provider-card').filter({hasText:'审查模型'}).getByRole('button',{name:'选为默认模型 ↗'}).click();
  await page.waitForFunction(()=>document.querySelector('.ocs-save-status')?.dataset.state==='error');
  const persistedId=await app.evaluate(()=>globalThis.__auditBank.getQuestionBankConfig().selectedProviderId);
  const selected=await page.locator('.provider-card.selected h3').innerText();
  check(persistedId==='audit'&&selected==='审查模型','Partial save keeps UI consistent',{persistedId,selected});
  // Reload settings without restarting the app, then exercise failure before model persistence.
  await page.getByRole('button',{name:'学习概览',exact:true}).first().click();
  await page.getByRole('button',{name:'模型接入',exact:true}).click();
  await app.evaluate(()=>globalThis.__auditFail='model');
  await page.locator('.provider-card').filter({hasText:'内置豆包'}).getByRole('button',{name:'选为默认模型 ↗'}).click();
  await page.waitForFunction(()=>document.querySelector('.ocs-save-status')?.dataset.state==='error');
  check(await page.locator('.provider-card.selected h3').innerText()==='审查模型','Failed model save restores selection');
  await app.evaluate(()=>globalThis.__auditFail='model');
  await page.getByRole('button',{name:'思考模式：模型默认',exact:true}).click();
  await page.waitForTimeout(250);
  check(await page.getByRole('button',{name:'思考模式：模型默认',exact:true}).count()===1,'Failed capability save restores switch');
  await app.evaluate(()=>{
   const axios=globalThis.__modelTest.modules.axios;
   axios.interceptors.request.use(config=>{if(config.url.includes('/ocs-global-setting'))globalThis.__auditTimeout=config.timeout;return config;});
  });
  await app.evaluate(()=>globalThis.__modelTest.course.webContents.executeJavaScript("new Promise((resolve,reject)=>GM_xmlhttpRequest({url:'http://localhost:15329/ocs-global-setting',timeout:150000,onload:resolve,onerror:reject}))"));
  const timeout=await app.evaluate(()=>globalThis.__auditTimeout);
  check(timeout===150000,'GM bridge honors answerer timeout',timeout);
  const report={result:results.every(x=>x.ok)?'PASS':'FAIL',results};
  fs.writeFileSync(path.join(evidence,process.env.AUDIT_BASELINE?'audit-ui-before-result.json':'audit-ui-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  assert(results.every(x=>x.ok),'Audit regressions failed');
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
