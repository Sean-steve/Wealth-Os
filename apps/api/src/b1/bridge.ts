import type {FastifyReply,FastifyRequest} from 'fastify';
import type {TenantContext} from '../db.js';
import type {Principal} from '../auth.js';

export interface B1HttpResult {status:number;body:Record<string,unknown>;headers?:Record<string,string>}
export interface B1Tools {
 authFor:(request:FastifyRequest)=>{principal:Principal;tenantId:string};
 idempotent:(ctx:TenantContext,request:FastifyRequest,body:unknown,run:()=>Promise<B1HttpResult>)=>Promise<B1HttpResult>;
 audit:(ctx:TenantContext,request:FastifyRequest,aggregate:string,id:string,eventType:string,prior:unknown,next:unknown)=>Promise<unknown>;
 result:(reply:FastifyReply,response:B1HttpResult)=>FastifyReply;
}
