import {z} from 'zod';
import {money,uuid,goalFields} from './contracts.js';

export const milestoneCreate=z.object({
 title:z.string().trim().min(1).max(160),
 targetAmount:money,
 dueDate:goalFields.targetDate
}).strict();
export const milestonePatch=z.object({
 title:z.string().trim().min(1).max(160).optional(),
 targetAmount:money.optional(),
 dueDate:goalFields.targetDate.optional(),
 status:z.enum(['PLANNED','REACHED','MISSED','CANCELLED']).optional()
}).strict().refine(o=>Object.keys(o).length>0,'At least one field must be specified.');

const allocation=z.object({
 label:z.string().trim().min(1).max(120),
 basisPoints:z.number().int().min(0).max(10000)
}).strict();
const strategyBase=z.object({
 goalId:uuid,
 name:z.string().trim().min(1).max(200),
 thesis:z.string().max(3000).default(''),
 allocationTargets:z.array(allocation).min(1).max(20),
 assumptions:z.object({
  riskTolerance:z.enum(['CONSERVATIVE','BALANCED','GROWTH']),
  horizonYears:z.number().int().min(1).max(60),
  assumedAnnualReturnPct:z.number().min(-50).max(50)
 }).strict()
}).strict();
const allocationWeights=(items:{basisPoints:number}[])=>items.reduce((n,x)=>n+x.basisPoints,0)===10000;
export const strategyInput=strategyBase.refine(s=>allocationWeights(s.allocationTargets),
 'Strategy allocations must sum to exactly 10000 basis points (100%).');
export const proposalInput=z.object({
 poolId:uuid,
 target:z.string().trim().min(3).max(200),
 amount:money,
 rationale:z.string().trim().min(20).max(1200)
}).strict();
export const strategyEdit=strategyBase.omit({goalId:true}).refine(s=>allocationWeights(s.allocationTargets),
 'Strategy allocations must sum to exactly 10000 basis points (100%).');
export const activeStatuses=['DRAFT','UNDER_REVIEW','PLANNING_ACKNOWLEDGED'] as const;
