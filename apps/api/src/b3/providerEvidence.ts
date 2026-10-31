import {fail} from '../errors.js';
import type {SourceSnapshot} from '../b2/sourceContracts.js';

/**
 * A signed transport token proves producer identity, not the truth of its values.
 * Staging must also verify producer-owned evidence references before allowing
 * the semantic quality label VERIFIED to be ingested.
 */
const ref=(v:unknown):boolean=>typeof v==='string'&&v.length>=12&&v.length<=200&&
 /^[a-zA-Z0-9._:\/-]+$/.test(v)&&!v.toLowerCase().includes('demo')&&
 !v.toLowerCase().includes('placeholder');
export function verifySourceEvidence(snapshot:SourceSnapshot,strict:boolean){
 if(!strict)return;
 for(const h of snapshot.holdings){
  if(h.qualityStatus!=='VERIFIED')continue; // Unverified holdings remain unreportable.
  const missing=snapshot.sourceSystem==='Finance OS'
   ?!ref(h.provenance.reconciliationRef)
   :snapshot.sourceSystem==='Asset OS'
   ?!ref(h.provenance.ownershipProofRef)||!ref(h.provenance.approvedValuationRef)
   :!ref(h.provenance.equityRegisterRef)||!ref(h.provenance.reviewedStatementRef);
  if(missing)fail(422,'SOURCE_EVIDENCE_MISSING',
   'A VERIFIED holding requires authority-specific reconciliation, valuation and ownership proof references.');
 }
 if(snapshot.sourceSystem==='Finance OS'){
  for(const l of snapshot.liabilities)if(!ref(l.provenance.reconciliationRef))
   fail(422,'LIABILITY_EVIDENCE_MISSING','Liabilities require a Finance OS reconciliation proof.');
  for(const p of snapshot.capitalPools)if(!ref(p.sourceEntityRef)||!ref(snapshot.completenessEvidence.attestation))
   fail(422,'CAPITAL_EVIDENCE_MISSING','Capital classification requires an attested Finance OS source.');
 }
 for(const i of snapshot.incomes)if(!ref(i.provenance.incomeStatementRef))
  fail(422,'INCOME_EVIDENCE_MISSING','Projected income requires a source statement or verified provider evidence reference.');
}
export function assessCurrentProviderContracts(){
 return {
  finance:{
   repository:'Sean-steve/Finance-Os',
   accountContract:'/v1/workspaces/{workspaceId}/accounts',
   accountQuality:'MANUAL_RECORD',
   canProvideVerifiedBalancesDirectly:false,
   reason:'The inspected B1 account balanceQuality is MANUAL_RECORD. Signed reconciled statement proof is needed before wealth projection.'
  },
  asset:{
   repository:'Sean-steve/Asset-Os',
   registryContract:'/v1/assets',
   canProvideVerifiedOwnershipDirectly:false,
   reason:'Registry value alone is not accepted economic ownership or valuation evidence. Requires approved ownership and valuation records.'
  },
  company:{
   repository:'not independently verified',
   canProvideLiveData:false,
   reason:'No verified Company OS publisher endpoint or statement/ownership contract is provisioned.'
  }
 } as const;
}
