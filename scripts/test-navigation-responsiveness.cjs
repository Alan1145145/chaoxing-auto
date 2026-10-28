const {_electron:electron}=require('playwright-core');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const evidence=path.resolve(__dirname,'../docs/model-browser-fixes');
 const profile=fs.mkdtempSync(path.join(evidence,'navigation-ui-profile-'));
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({version:'0.0.0',render:{state:{first:false,setup:false,newBrowserSetup:false},notifies:[{id:'chaoxing-auto-tutorial-1.0.0',content:[]}]}}));
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'model-test-bootstrap.cjs')],cwd:path.resolve(__dirname,'../packages/app'),env:{...process.env,MODEL_TEST_PROFILE:profile}});
 const results=[],errors=[];
 try {
  const page=await app.firstWindow();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error' && !m.text().includes('Failed to load resource: net::ERR_CONNECTION_REFUSED'))errors.push(m.text().slice(0,500));});
  await page.waitForSelector('.app-navigation');
  await page.evaluate(()=>{window.__navHeartbeat=0;window.__navLongTasks=[];setInterval(()=>window.__navHeartbeat++,50);new PerformanceObserver(list=>window.__navLongTasks.push(...list.getEntries().map(x=>x.duration))).observe({type:'longtask',buffered:true});});
  const menus=await page.locator('.app-navigation>button[aria-label]').evaluateAll(els=>[...new Set(els.map(el=>el.getAttribute('aria-label')))]);
  for(let round=0;round<3;round++) for(const menu of menus){
   const before=await page.evaluate(()=>window.__navHeartbeat);
   const begin=Date.now();
   await page.locator('.app-navigation').getByRole('button',{name:menu,exact:true}).first().click();
   await page.waitForTimeout(round===0?350:80);
   const state=await page.evaluate(()=>({hash:location.hash,heartbeat:window.__navHeartbeat,overlays:[...document.querySelectorAll('.arco-modal-container,.arco-drawer-container')].filter(el=>getComputedStyle(el).display!=='none').map(el=>({text:el.textContent.slice(0,160),opacity:getComputedStyle(el).opacity})),blocked:[...document.querySelectorAll('.page-swap-enter-active,.page-swap-leave-active')].map(el=>el.className)}));
   results.push({menu,round,elapsed:Date.now()-begin,advanced:state.heartbeat>before,...state});
   console.log(JSON.stringify(results.at(-1)));
  }
  // Rapid switches while the previous view is still entering/leaving.
  for(let i=0;i<20;i++)await page.locator('.app-navigation').getByRole('button',{name:i%2?'模型接入':'软件设置',exact:true}).click({delay:5});
  await page.waitForTimeout(600);
  const responsive=await page.evaluate(()=>({heartbeat:window.__navHeartbeat,longTasks:window.__navLongTasks,classes:[...document.querySelectorAll('[class*="page-swap"]')].map(x=>x.className)}));
  for(let i=0;i<3;i++) {
   await page.evaluate(()=>location.hash='/browser/navigation-fixture');
   await page.locator('webview:visible').waitFor();
   await page.waitForFunction(()=>{try{return document.querySelector('webview').getWebContentsId()>0;}catch{return false;}});
   await page.locator('webview:visible').click({position:{x:300,y:200}});
   await page.locator('.app-navigation').getByRole('button',{name:'模型接入',exact:true}).click();
   await page.getByRole('button',{name:'添加模型',exact:false}).click();
   await page.locator('.model-provider-dialog').waitFor();
   await page.locator('.model-provider-dialog').getByRole('button',{name:'取消',exact:true}).click();
   await page.locator('.model-provider-dialog').waitFor({state:'hidden'});
   console.log('browser-return-modal',i);
  }
  await page.locator('.app-navigation').getByRole('button',{name:'软件设置',exact:true}).click();
  await page.locator('.settings-nav button').filter({hasText:'课程脚本'}).click();
  for(let i=0;i<3;i++) {
   await page.getByRole('button',{name:'打开配置 ↗',exact:true}).click();
   await page.getByText('正在获取最新OCS配置...').waitFor({state:'hidden'});
   await page.waitForTimeout(1000);
   console.log('script-config',i,await page.evaluate(()=>({heartbeat:window.__navHeartbeat,text:document.querySelector('.arco-modal-container')?.textContent.slice(0,500),longTasks:window.__navLongTasks.slice(-10)})));
   await page.locator('.arco-modal-close-btn:visible').click();
  }
  await page.screenshot({path:path.join(evidence,'navigation-state.png')});
  const report={result:errors.length?'FAIL':'PASS',results,responsive,errors};
  fs.writeFileSync(path.join(evidence,'navigation-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({responsive,errors}));
  assert(!errors.length,'Navigation emitted errors');
 }catch(error){
  try{const page=await app.firstWindow();await page.screenshot({path:path.join(evidence,'navigation-failed.png'),timeout:3000});console.log('failure-state',await page.evaluate(()=>({hash:location.hash,text:document.body.innerText.slice(-1000)})));}catch{}
  console.error(JSON.stringify({results,errors}));throw error;
 }finally{await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.destroy();}).catch(()=>{});await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
