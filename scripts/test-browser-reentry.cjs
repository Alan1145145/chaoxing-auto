const {_electron:electron}=require('playwright-core');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const evidence=path.resolve(__dirname,'../docs/model-browser-fixes');
 const profile=fs.mkdtempSync(path.join(evidence,'reentry-ui-profile-'));
 const uid='reentry-fixture';
 fs.writeFileSync(path.join(profile,'config.json'),JSON.stringify({version:'0.0.0',render:{state:{first:false,setup:false,newBrowserSetup:false},browser:{root:{type:'root',uid:'root-folder',name:'根目录',createTime:Date.now(),children:{[uid]:{uid,name:'重入测试浏览器',type:'browser',tags:[],notes:'',histories:[],automationScripts:[],embeddedScriptVersions:{},checked:false,parent:'root-folder',createTime:Date.now(),cachePath:path.join(profile,'browser-cache')}}}},notifies:[{id:'chaoxing-auto-tutorial-1.0.0',content:[]}]}}));
 const app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'model-test-bootstrap.cjs')],cwd:path.resolve(__dirname,'../packages/app'),env:{...process.env,MODEL_TEST_PROFILE:profile}});
 const errors=[],results=[];
 try {
  const page=await app.firstWindow();page.setDefaultTimeout(6000);
  page.on('pageerror',e=>errors.push(String(e)));
  await page.waitForSelector('.app-navigation');
  await page.evaluate(()=>{window.__heartbeat=0;setInterval(()=>window.__heartbeat++,50);location.hash='/browsers';});
  for(let round=0;round<8;round++) {
   const trigger=page.locator('.space-card').getByRole('button',{name:round?'切换到窗口':'内嵌打开',exact:false});
   if(round%2===1) {
    await page.locator('.space-name').click();
    await page.locator('.arco-modal:visible').getByRole('button',{name:'切换到窗口',exact:false}).click();
   } else await trigger.click();
   await page.locator('webview:visible').waitFor();
   await page.waitForTimeout(round?250:1200);
   const webviewId=await page.locator('webview:visible').evaluate(v=>v.getWebContentsId());
   await page.locator('webview:visible').click({position:{x:300,y:200}});
   const heartbeat=await page.evaluate(()=>window.__heartbeat);
   await page.getByRole('button',{name:'返回列表',exact:true}).filter({visible:true}).click();
   await page.locator('.space-card').waitFor();
   await page.waitForTimeout(500);
   const state=await page.evaluate(()=>({hash:location.hash,heartbeat:window.__heartbeat,modal:[...document.querySelectorAll('.arco-modal-container')].filter(el=>getComputedStyle(el).display!=='none').map(el=>el.textContent.slice(0,80)),activeElement:document.activeElement?.tagName}));
   results.push({round,webviewId,advanced:state.heartbeat>heartbeat,...state});
   console.log(JSON.stringify(results.at(-1)));
   assert(state.heartbeat>heartbeat,'Renderer stopped responding after return');
   assert.equal(webviewId,results[0].webviewId,'Returning recreated the course WebContents');
   assert.equal(state.modal.length,0,'Browser details overlay remained after return');
  }
  // A delayed activation reply must never focus a guest after returning to the list.
  await app.evaluate(({ipcMain})=>{
   const handlers=ipcMain.listeners('methods-call');
   ipcMain.removeAllListeners('methods-call');
   globalThis.__reentryPending=[];
   ipcMain.on('methods-call',(event,args)=>{
    const run=()=>handlers.forEach(handler=>handler(event,args));
    if(args[1]==='registerEmbeddedWebContents' && args[4]===true)globalThis.__reentryPending.push(run);else run();
   });
  });
  await page.locator('webview').evaluate(view=>{
   window.__hiddenGuestFocus=0;const focus=view.focus.bind(view);
   view.focus=(...args)=>{if(!view.getBoundingClientRect().width || !view.checkVisibility())window.__hiddenGuestFocus++;return focus(...args);};
  });
  await page.locator('.space-card').getByRole('button',{name:'切换到窗口',exact:false}).click();
  await page.waitForTimeout(150);
  assert(await app.evaluate(()=>globalThis.__reentryPending.length)>0,'Activation reply was not delayed');
  await page.getByRole('button',{name:'返回列表',exact:true}).filter({visible:true}).click();
  await page.locator('.space-card').waitFor();
  await app.evaluate(()=>globalThis.__reentryPending.splice(0).forEach(run=>run()));
  await page.waitForTimeout(250);
  const lateFocus=await page.evaluate(()=>({calls:window.__hiddenGuestFocus,active:document.activeElement?.tagName,hash:location.hash}));
  console.log('late-activation',lateFocus);
  assert.equal(lateFocus.calls,0,'Delayed activation focuses a hidden guest after returning to the list');
  await page.locator('.app-navigation').getByRole('button',{name:'模型接入',exact:true}).click();
  await page.getByRole('button',{name:'添加模型',exact:false}).click();
  const nameInput=page.locator('.model-provider-dialog .arco-input').first();
  await nameInput.fill('返回后仍可输入');
  await nameInput.press('End');await nameInput.press('!');
  assert.equal(await nameInput.inputValue(),'返回后仍可输入!','Host input lost keyboard focus');
  await page.locator('.model-provider-dialog').getByRole('button',{name:'取消',exact:true}).click();
  assert(!errors.length,errors.join('\n'));
  await page.screenshot({path:path.join(evidence,'reentry-state.png')});
  fs.writeFileSync(path.join(evidence,'reentry-result.json'),JSON.stringify({result:'PASS',results,errors},null,2));
 } catch(error) {
  console.error('ERROR',error);
  fs.writeFileSync(path.join(evidence,'reentry-result.json'),JSON.stringify({result:'FAIL',results,errors,error:String(error)},null,2));
  throw error;
 } finally {await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.destroy();}).catch(()=>{});await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
