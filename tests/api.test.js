const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createServer } = require('node:net');
async function freePort() {
  const srv = createServer();
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const port = srv.address().port;
  await new Promise(resolve => srv.close(resolve));
  return port;
}
async function start() {
  const dir = mkdtempSync(join(tmpdir(), 'portfolio-api-'));
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], { cwd: join(__dirname, '..'), env: {...process.env, PORT: String(port), DB_FILE: join(dir, 'test.db')}, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i=0; i<80; i++) {
    if (child.exitCode !== null) throw Error('Server terminated early');
    try { const r=await fetch(base + '/api/agents'); if(r.ok) return {child,dir,base}; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill(); rmSync(dir, {recursive:true,force:true});
  throw Error('Timed out waiting for application');
}
async function json(base,path,method='GET',data) {
 const r=await fetch(base+path,{method,headers:{'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 return [r.status,await r.json()];
}
test('real API: create, list, and reject invalid input', async t => {
 const {child,dir,base}=await start();
 t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true})});
 const [badStatus]=await json(base,'/api/agents','POST',{});
 assert.equal(badStatus,400);
 const [createStatus]=await json(base,'/api/agents','POST',{"name": "Morgan"});
 assert.equal(createStatus,200);
 const [listStatus,items]=await json(base,'/api/agents');
 assert.equal(listStatus,200);assert.equal(items.length,1);
 const [secondStatus]=await json(base,'/api/tickets','POST',{"subject": "Billing question", "customer_email": "client@example.com", "description": "Please investigate", "priority": "normal"});
 assert.equal(secondStatus,200);
 const [,secondItems]=await json(base,'/api/tickets');
 assert.equal(secondItems.length,1);
});


test('CSV export endpoint: documented, read-only, safely cached', async t => {
  const {child,dir,base}=await start();
  t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true})});
  const response=await fetch(base+'/api/export/tickets.csv');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/csv/i);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const contents=await response.text();
  assert.ok(contents.includes('"id"'));
});


test('status-only ticket updates retain the assigned agent',async t=>{
 const {child,dir,base}=await start();
 t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true})});
 const [,agent]=await json(base,'/api/agents','POST',{name:'Ada'});
 const [,ticket]=await json(base,'/api/tickets','POST',{
  subject:'Access request',customer_email:'test@example.com',
  description:'Please review',priority:'normal'
 });
 await json(base,'/api/tickets/'+ticket.lastInsertRowid,'PATCH',{agent_id:agent.lastInsertRowid});
 await json(base,'/api/tickets/'+ticket.lastInsertRowid,'PATCH',{status:'pending'});
 const [,tickets]=await json(base,'/api/tickets');
 assert.equal(tickets[0].agent_id,agent.lastInsertRowid);
 assert.equal(tickets[0].status,'pending');
});

test('workflow history captures one transition and ignores no-op updates', async t=>{
  const {child,dir,base}=await start();
  t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true})});
  assert.equal((await json(base,"/api/tickets","POST",{"subject":"Audit Ticket","customer_email":"review@example.com","description":"Audit workflow"}))[0],200);
  assert.equal((await json(base,"/api/tickets/1","PATCH",{"status":"pending"}))[0],200);
  let [status,events]=await json(base,'/api/tickets/1/history');
  assert.equal(status,200);
  assert.equal(events.length,1);
  assert.equal(events[0].new_value,"pending");
  assert.equal((await json(base,"/api/tickets/1",'PATCH',{"status":"pending"}))[0],200);
  const [,eventsAfterNoop]=await json(base,'/api/tickets/1/history');
  assert.equal(eventsAfterNoop.length,1);

  assert.equal((await json(base,'/api/tickets/999999/history'))[0],404);
});

test('response-time report tracks notes and excludes customer details', async t => {
 const {child,dir,base}=await start();
 t.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true})});
 const [,one]=await json(base,'/api/tickets','POST',{
   subject:'Urgent synthetic issue',customer_email:'sensitive@example.test',
   description:'Demo only',priority:'urgent'});
 await json(base,'/api/tickets','POST',{
   subject:'Other synthetic issue',customer_email:'other@example.test',
   description:'Demo only',priority:'urgent'});
 const before=await json(base,'/api/tickets/first-response-report');
 assert.equal(before[0],200);
 assert.equal(before[1].by_priority.find(x=>x.priority==='urgent').awaiting_response,2);
 const [noteStatus]=await json(base,'/api/tickets/'+one.lastInsertRowid+'/notes','POST',{body:'First response'});
 assert.equal(noteStatus,200);
 const [status,report]=await json(base,'/api/tickets/first-response-report');
 assert.equal(status,200);
 const urgent=report.by_priority.find(x=>x.priority==='urgent');
 assert.equal(urgent.responded,1);
 assert.equal(urgent.awaiting_response,1);
 assert.equal(typeof urgent.avg_first_response_minutes,'number');
 assert.ok(!JSON.stringify(report).includes('sensitive@example.test'));
});
