import {describe,it,expect} from 'vitest';
import {verifySourceEvidence,assessCurrentProviderContracts} from './providerEvidence.js';
import {sourceSnapshot} from '../b2/sourceContracts.js';
const now=new Date().toISOString();
const base={
 schemaVersion:1 as const,eventId:'7a7f1859-299b-43a0-a8a8-80f762a22378',
 sourceSystem:'Finance OS' as const,sourceRevision:'r1',asOf:now,personRef:'kernel:person:source',
 complete:true as const,
 completenessEvidence:{coverage:'ALL' as const,sourceRecordCount:2,
  attestation:'source:verified:reconciled-statement-ref'},
 holdings:[{
  sourceEntityType:'account',sourceEntityId:'account:123',canonicalAssetRef:'finance:account:123',
  category:'CASH' as const,ownerFraction:'1',valuationAmount:'1000',valuationCurrency:'KES' as const,
  valuationAsOf:now,valuationMethod:'provider reconciled balance',sourceVersion:'r1',
  qualityStatus:'VERIFIED' as const,provenance:{reconciliationRef:'finance:reconciliation:2026:ref'}
 }],
 incomes:[],liabilities:[{sourceEntityId:'finance:loan:123',outstandingAmount:'250',
  currency:'KES' as const,sourceAsOf:now,provenance:{reconciliationRef:'finance:loan:reconcile:ref'}}],capitalPools:[]
};
describe('B3 source-proof controls',()=>{
 it('requires authority-specific Finance account reconciliation instead of trusting a verified label',()=>{
  const absent=sourceSnapshot.parse({...base,holdings:[{...base.holdings[0],
   provenance:{review:'approved'}}]});
  expect(()=>verifySourceEvidence(absent,true)).toThrow('proof references');
  expect(()=>verifySourceEvidence(absent,false)).not.toThrow();
  expect(()=>verifySourceEvidence(sourceSnapshot.parse(base),true)).not.toThrow();
 });
 it('requires independent Asset ownership and reviewed valuation proof',()=>{
  const a={...base,sourceSystem:'Asset OS',liabilities:[],completenessEvidence:{
   ...base.completenessEvidence,sourceRecordCount:1},holdings:[{
    ...base.holdings[0],category:'PROPERTY',sourceEntityType:'property',
    provenance:{ownershipProofRef:'asset:ownership-proof:one',approvedValuationRef:'asset:approved-valuation:one'}
   }]};
  expect(()=>verifySourceEvidence(sourceSnapshot.parse(a),true)).not.toThrow();
  expect(()=>verifySourceEvidence(sourceSnapshot.parse({...a,holdings:[{
   ...a.holdings[0],provenance:{ownershipProofRef:'asset:ownership-proof:one'}
  }]}),true)).toThrow('proof references');
 });
 it('requires Company equity register plus verified financial statement',()=>{
  const c={...base,sourceSystem:'Company OS',liabilities:[],
   completenessEvidence:{...base.completenessEvidence,sourceRecordCount:1},
   holdings:[{...base.holdings[0],category:'BUSINESS_EQUITY',
    provenance:{equityRegisterRef:'company:register:verified-01',
     reviewedStatementRef:'company:statement:reviewed-01'}}]};
  expect(()=>verifySourceEvidence(sourceSnapshot.parse(c),true)).not.toThrow();
 });
 it('does not mark manually maintained Finance or Asset API records verified',()=>{
  const contracts=assessCurrentProviderContracts();
  expect(contracts.finance.canProvideVerifiedBalancesDirectly).toBe(false);
  expect(contracts.asset.canProvideVerifiedOwnershipDirectly).toBe(false);
  expect(contracts.company.canProvideLiveData).toBe(false);
 });
});
