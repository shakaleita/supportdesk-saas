const express=require('express'),Database=require('better-sqlite3');const app=express(),db=new Database(process.env.DB_FILE||'app.db');db.pragma('foreign_keys=ON');db.exec(`CREATE TABLE IF NOT EXISTS agents(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE);CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY,subject TEXT NOT NULL,customer_email TEXT NOT NULL,description TEXT NOT NULL,priority TEXT NOT NULL DEFAULT 'normal',status TEXT NOT NULL DEFAULT 'open',agent_id INTEGER REFERENCES agents(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);app.disable('x-powered-by');app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');res.set('X-Frame-Options','DENY');next()});app.use(express.json({limit:'32kb'}));app.use(express.static('public'));

const crypto = require('node:crypto');
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  const required = process.env.API_TOKEN;
  if (!required && process.env.APP_ENV !== 'production') return next();
  if (!required) return res.status(503).json({error:'API authentication must be configured in production'});
  const actual = req.get('x-api-token') || '';
  const expectedBytes = Buffer.from(required, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');
  if (expectedBytes.length !== actualBytes.length || !crypto.timingSafeEqual(expectedBytes, actualBytes)) {
    return res.status(401).json({error:'Unauthorized'});
  }
  next();
});

const wrap=fn=>(req,res)=>{try{res.json(fn(req))}catch(e){res.status(400).json({error:e.message})}};
app.get('/api/agents',wrap(()=>db.prepare('SELECT * FROM agents ORDER BY name').all()));app.post('/api/agents',wrap(req=>{if(!req.body.name?.trim())throw Error('Agent name required');return db.prepare('INSERT INTO agents(name) VALUES(?)').run(req.body.name.trim())}));
app.get('/api/tickets',wrap(req=>{const {status,priority}=req.query;if(status&&!['open','pending','resolved'].includes(status))throw Error('Invalid status');if(priority&&!['low','normal','urgent'].includes(priority))throw Error('Invalid priority');return db.prepare(`SELECT tickets.*,agents.name agent FROM tickets LEFT JOIN agents ON agents.id=tickets.agent_id WHERE (? IS NULL OR tickets.status=?) AND (? IS NULL OR tickets.priority=?) ORDER BY tickets.id DESC`).all(status||null,status||null,priority||null,priority||null)}));
app.post('/api/tickets',wrap(req=>{const {subject,customer_email,description,priority='normal'}=req.body;if(!subject?.trim()||!/^\S+@\S+\.\S+$/.test(customer_email||'')||!description?.trim()||!['low','normal','urgent'].includes(priority))throw Error('Valid subject, email, description, and priority required');return db.prepare('INSERT INTO tickets(subject,customer_email,description,priority) VALUES(?,?,?,?)').run(subject.trim(),customer_email,description.trim(),priority)}));
app.patch('/api/tickets/:id',wrap(req=>{const {status,agent_id}=req.body;if(status&&!['open','pending','resolved'].includes(status))throw Error('Invalid status');const hasAgent=Object.prototype.hasOwnProperty.call(req.body,'agent_id');
if(hasAgent && agent_id!==null && agent_id!=='' &&
  (!Number.isSafeInteger(Number(agent_id)) || Number(agent_id)<1))throw Error('Invalid agent ID');
const r=db.prepare('UPDATE tickets SET status=COALESCE(?,status),agent_id=CASE WHEN ? THEN ? ELSE agent_id END WHERE id=?')
  .run(status||null,hasAgent?1:0,agent_id||null,req.params.id);if(!r.changes)throw Error('Ticket not found');return {updated:true}}));
app.get('/api/tickets/:id/notes',wrap(req=>db.prepare('SELECT * FROM notes WHERE ticket_id=? ORDER BY id DESC').all(req.params.id)));app.post('/api/tickets/:id/notes',wrap(req=>{if(!req.body.body?.trim())throw Error('Note required');return db.prepare('INSERT INTO notes(ticket_id,body) VALUES(?,?)').run(req.params.id,req.body.body.trim())}));
// Safe, read-only CSV export for the local tickets dataset.
app.get('/api/export/tickets.csv', (_req,res)=>{
  try {
    const {serialize}=require('./lib/csv');
    const stmt=db.prepare("SELECT id,subject,customer_email,priority,status,created_at FROM tickets ORDER BY id");
    const rows=stmt.all();
    const columns=stmt.columns().map(column=>column.name);
    res.set('Content-Type','text/csv; charset=utf-8');
    res.set('Content-Disposition','attachment; filename="tickets.csv"');
    res.set('Cache-Control','no-store');
    res.send(serialize(rows,columns));
  }catch(_error){res.status(500).json({error:'CSV export unavailable'})}
});

// Lightweight service introspection: intentionally no secrets or database contents.
app.get('/api/health',(_req,res)=>{try{db.prepare('SELECT 1').get();res.json({status:'ok',service:process.env.npm_package_name||'portfolio-service'})}catch(_e){res.status(503).json({status:'unavailable'})}});
app.get('/api/insights',(_req,res)=>{try{res.json((()=>{ const statuses=db.prepare('SELECT status,COUNT(*) count FROM tickets GROUP BY status ORDER BY status').all();const priority=db.prepare('SELECT priority,COUNT(*) count FROM tickets GROUP BY priority ORDER BY priority').all();const unassigned=db.prepare("SELECT COUNT(*) n FROM tickets WHERE agent_id IS NULL AND status != 'resolved'").get().n;return {tickets_by_status:statuses,tickets_by_priority:priority,unassigned_open_tickets:unassigned}; })())}catch(_e){res.status(500).json({error:'Unable to load insights'})}});
app.use((err,req,res,next)=>{if(err&&err.type==='entity.too.large')return res.status(413).json({error:'Request body too large'});if(err instanceof SyntaxError && 'body' in err)return res.status(400).json({error:'Malformed JSON'});return res.status(500).json({error:'Unexpected server error'})});
app.listen(Number(process.env.PORT)||3000);
