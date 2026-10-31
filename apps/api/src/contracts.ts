import {z} from 'zod';
import {fail} from './errors.js';

export const uuid=z.string().uuid();
export const tenantHeader=uuid;
export const money=z.string().regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/,'Money must be a decimal string with up to four decimal places.')
 .refine(x=>Number(x)>0,'Amount must be greater than zero.');
export const profileInput=z.object({
 baseCurrency:z.literal('KES'), // B0 does not claim FX support.
 wealthStage:z.enum(['BUILDING','GROWING','PROTECTING','INDEPENDENT','LEGACY']),
 strategyNote:z.string().max(2000).default('')
}).strict();
export const goalFields={
 title:z.string().trim().min(1).max(160),
 metric:z.enum(['NET_WORTH','LIQUID_WEALTH','PASSIVE_INCOME','DEPLOYABLE_CAPITAL','INVESTED_CAPITAL','CUSTOM']),
 targetAmount:money,
 targetDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Invalid calendar date'),
 priority:z.enum(['LOW','MEDIUM','HIGH']),
 status:z.enum(['ACTIVE','PAUSED','COMPLETED','ARCHIVED'])
};
export const createGoalInput=z.object({
 title:goalFields.title,metric:goalFields.metric,targetAmount:goalFields.targetAmount,
 targetDate:goalFields.targetDate,priority:goalFields.priority.default('MEDIUM')
}).strict();
export const updateGoalInput=z.object({
 title:goalFields.title.optional(),metric:goalFields.metric.optional(),targetAmount:goalFields.targetAmount.optional(),
 targetDate:goalFields.targetDate.optional(),priority:goalFields.priority.optional(),status:goalFields.status.optional()
}).strict().refine(x=>Object.keys(x).length>0,'At least one changed field is required.');
export function etagFor(version:string|number):string{return '"'+String(version)+'"'}
export function expectedVersion(raw:string|undefined):number{
 if(!raw)fail(428,'PRECONDITION_REQUIRED','If-Match version is required.');
 const match=/^"(0|[1-9]\d{0,14})"$/.exec(raw);
 if(!match)fail(400,'INVALID_ETAG','If-Match must be a quoted integer version, for example "1".');
 const value=Number(match[1]);
 if(!Number.isSafeInteger(value))fail(400,'INVALID_ETAG','Invalid version.');
 return value;
}
export function cursorParse(raw:unknown):{at:string;id:string}|null{
 if(raw===undefined)return null;
 if(typeof raw!=='string'||raw.length>300)fail(400,'INVALID_CURSOR','Invalid page cursor.');
 try{
  const data:unknown=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
  const schema=z.object({at:z.string().datetime(),id:uuid}).strict();
  return schema.parse(data);
 }catch{fail(400,'INVALID_CURSOR','Invalid page cursor.')}
}
export function cursorEncode(row:{created_at:Date|string;id:string}):string{
 return Buffer.from(JSON.stringify({at:new Date(row.created_at).toISOString(),id:row.id})).toString('base64url');
}
