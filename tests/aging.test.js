const {test}=require('node:test');const assert=require('node:assert/strict');
const {report}=require('../lib/aging');
test('exclude resolved tickets and age tickets by priority',()=>{
 let r=report([{priority:'urgent',status:'open',created_at:'2026-01-01 10:00:00'},
 {priority:'normal',status:'pending',created_at:'2026-01-01 11:00:00'},
 {priority:'low',status:'resolved',created_at:'2025-01-01 00:00:00'}],new Date('2026-01-01T13:00:00Z'));
 assert.equal(r.active_tickets,2);assert.equal(r.overdue_tickets,1);
 assert.equal(r.by_priority.urgent.overdue,1);
});
test('never reports negative age',()=>{
 let r=report([{priority:'urgent',status:'open',created_at:'2026-01-02 00:00:00'}],new Date('2026-01-01T00:00:00Z'));
 assert.equal(r.overdue_tickets,0)
});
