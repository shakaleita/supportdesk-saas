'use strict';
/** Ticket aging in minutes, calculated without claiming a contractual SLA. */
function report(rows, now = new Date()) {
  if (!Array.isArray(rows) || Number.isNaN(now.getTime())) throw new TypeError('Invalid ticket data or time');
  const thresholds={urgent:60,normal:240,low:1440}; // illustrative, not an SLA commitment
  const active=rows.filter(x=>x.status!=='resolved');
  let overdue=0;
  const by_priority={low:{active:0,overdue:0},normal:{active:0,overdue:0},urgent:{active:0,overdue:0}};
  for(const ticket of active){
    const bucket=by_priority[ticket.priority];
    if(!bucket)throw new TypeError('Unknown ticket priority');
    const created=new Date(String(ticket.created_at).replace(' ','T')+'Z');
    if(Number.isNaN(created.getTime()))throw new TypeError('Invalid ticket creation time');
    const age=Math.max(0,Math.floor((now-created)/60000));
    const late=age>thresholds[ticket.priority];
    bucket.active++;if(late){bucket.overdue++;overdue++}
  }
  return {status:'illustrative_thresholds_not_contractual_sla',threshold_minutes:thresholds,
    checked_at:now.toISOString(),active_tickets:active.length,overdue_tickets:overdue,by_priority};
}
module.exports={report};
