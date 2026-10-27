const {app}=require('electron');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const evidence=path.resolve(__dirname,'../docs/model-browser-fixes');
app.setPath('userData',fs.mkdtempSync(path.join(evidence,'response-profile-')));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const bank=require(path.join(process.env.MODEL_TEST_APP_ROOT||path.resolve(__dirname,'../packages/app'),'lib/src/services/question-bank'));
 const fixtures={
  'chat-length':{choices:[{finish_reason:'length',message:{content:'{"answer":"partial"}'}}]},
  'chat-refusal':{choices:[{finish_reason:'stop',message:{content:'{"answer":"partial"}',refusal:'refused'}}]},
  'chat-tool':{choices:[{finish_reason:'tool_calls',message:{content:'{"answer":"partial"}',tool_calls:[{type:'function'}]}}]},
  'anthropic-length':{stop_reason:'max_tokens',content:[{type:'text',text:'{"answer":"partial"}'}]},
  'anthropic-pause':{stop_reason:'pause_turn',content:[{type:'text',text:'{"answer":"partial"}'}]},
  'anthropic-context':{stop_reason:'model_context_window_exceeded',content:[{type:'text',text:'{"answer":"partial"}'}]},
  'gemini-length':{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"answer":"partial"}'}]}}]},
  'gemini-safety':{candidates:[{finishReason:'SAFETY',content:{parts:[{text:'{"answer":"partial"}'}]}}]},
  'stream-error':'data: {"choices":[{"delta":{"content":"{\\\"answer\\\":\\\"partial\\\"}"}}]}\n\ndata: {"error":{"message":"quota for audit-secret"}}\n\n',
  'stream-length':'data: {"choices":[{"delta":{"content":"{\\\"answer\\\":\\\"partial\\\"}"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',
  'stream-cut':'data: {"choices":[{"delta":{"content":"{\\\"answer\\\":\\\"partial\\\"}"}}]}\n\n',
  'stream-event-error':'data: {"choices":[{"delta":{"content":"{\\\"answer\\\":\\\"partial\\\"}"}}]}\n\nevent: error\ndata: {"message":"quota for audit-secret"}\n\ndata: [DONE]\n\n',
  'chat-ok':{choices:[{finish_reason:'stop',message:{content:'{"answer":"OK"}'}}]},
  'anthropic-ok':{stop_reason:'end_turn',content:[{type:'text',text:'{"answer":"OK"}'}]},
  'gemini-ok':{candidates:[{finishReason:'STOP',content:{parts:[{text:'{"answer":"OK"}'}]}}]},
  'stream-ok':': heartbeat\n\ndata:\n\ndata: {"choices":[{"delta":{"content":"{\\\"answer\\\":\\\"OK\\\"}"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
 };
 const server=http.createServer(async(req,res)=>{for await(const chunk of req){}const name=req.url.split('/')[1];const value=fixtures[name];res.setHeader('Content-Type',typeof value==='string'?'text/event-stream':'application/json');res.end(typeof value==='string'?value:JSON.stringify(value));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const results=[];
 try {
  for(const name of Object.keys(fixtures)){
   const protocol=name.startsWith('anthropic')?'anthropic':name.startsWith('gemini')?'gemini':'openai-chat';
   bank.saveQuestionBankConfig({providers:[{id:'response-fixture',name:'Response fixture',protocol,model:'fixture',baseUrl:base+'/'+name,apiKey:'audit-secret',enabled:true}],selectedProviderId:'response-fixture',autoSaveAiAnswers:true});
   const count=bank.exportQuestionBankQuestions().length;
   let rejected=false,secretHidden=true;
   try{await bank.queryQuestionBank({title:'audit '+name});}catch(error){rejected=true;secretHidden=!error.message.includes('audit-secret');}
   const after=bank.exportQuestionBankQuestions().length;
   results.push({name,ok:name.endsWith('-ok')?!rejected&&after===count+1:rejected&&after===count&&secretHidden,rejected,saved:after-count});
  }
  const report={result:results.every(x=>x.ok)?'PASS':'FAIL',results};fs.writeFileSync(path.join(evidence,process.env.AUDIT_BASELINE?'audit-responses-before-result.json':'audit-responses-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(results.every(x=>x.ok),'Response errors accepted as answers');
 } finally {server.closeAllConnections();server.close();app.quit();}
}).catch(error=>{console.error(error);app.exit(1);});
