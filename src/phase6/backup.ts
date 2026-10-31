import {hydrateState} from '../phase2/model';
import type {WealthState} from '../phase2/model';
import {hasValidExtensions,isValidCoreState} from './validation';

const LIMIT=3*1024*1024;
export const BACKUP_FORMAT='wealth-os-local-demo';
export const BACKUP_VERSION=1;
export function makeWorkspaceBackup(state:WealthState,exportedAt=new Date().toISOString()):string{
 return JSON.stringify({
  format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt,
  notice:'Fictional sample workspace. This JSON file is unencrypted, not a verified account or financial record.',
  workspace:state
 },null,2);
}
export function readWorkspaceBackup(json:string):WealthState{
 if(typeof json!=='string'||json.length===0||json.length>LIMIT)throw Error('Backup file is empty or too large (3 MB maximum).');
 let parsed:unknown;
 try{parsed=JSON.parse(json)}catch{throw Error('The selected file is not valid JSON. No local data was changed.')}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Unexpected backup document.');
 const envelope=parsed as Record<string,unknown>;
 if(envelope.format!==BACKUP_FORMAT||!['undefined','number'].includes(typeof envelope.version)||typeof envelope.version==='number'&&envelope.version>BACKUP_VERSION){
  throw Error('Unsupported backup format or newer version. No local data was changed.');
 }
 if(!isValidCoreState(envelope.workspace)||!hasValidExtensions(envelope.workspace))throw Error('Backup failed wealth-state integrity checks. No local data was changed.');
 return hydrateState(envelope.workspace);
}
