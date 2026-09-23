import {
  approveInternalFirstPartyTarget,
  FIRST_PARTY_BRIDGE_VERSION,
  preflightTestTarget,
  type TestTargetSnapshotV1,
} from "./test-target-import.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DraftPrototypeVersion = Readonly<{
  id: string; workspaceId: string; testId: string; versionNo: number; target: TestTargetSnapshotV1;
}>;

export class PrototypeImportError extends Error {
  code: "invalid_test_id" | "invalid_prototype_url" | "test_not_found" | "permission_denied" | "target_preflight_failed" | "data_request_failed";
  status: number;
  constructor(code: PrototypeImportError["code"], status: number, message: string = code) { super(message); this.name = "PrototypeImportError"; this.code = code; this.status = status; }
}

type TestRow = Readonly<{ id: string; workspace_id: string }>;
type VersionRow = Readonly<{ id:string; workspace_id:string; test_id:string; version_no:number; lifecycle_status:string; target_provider:string|null; target_snapshot:Record<string,unknown>|null; figma_file_key:string|null; figma_start_node_id:string|null; prototype_mapping:Record<string,unknown> }>;

function requiredTestId(value:string){ if(!UUID_PATTERN.test(value)) throw new PrototypeImportError("invalid_test_id",400); return value; }
function targetFromRow(row:VersionRow): TestTargetSnapshotV1|null {
  const t=row.target_snapshot;
  if(t && t.snapshotVersion===1 && typeof t.provider==="string" && typeof t.sourceUrl==="string") return t as unknown as TestTargetSnapshotV1;
  return null;
}

export function validatePrototypeImport(prototypeUrl:string): TestTargetSnapshotV1 {
  try { return preflightTestTarget({url:prototypeUrl}); } catch(error){ throw new PrototypeImportError("invalid_prototype_url",400,error instanceof Error?error.message:"invalid_prototype_url"); }
}

export function createDraftPrototypeStore(options:{supabaseUrl:string;publicKey:string;accessToken:string;fetchImpl?:typeof fetch}){
  const supabaseUrl=options.supabaseUrl.trim().replace(/\/+$/,""); const publicKey=options.publicKey.trim(); const accessToken=options.accessToken.trim(); const fetchImpl=options.fetchImpl??fetch;
  if(!supabaseUrl.startsWith("https://")||!publicKey||!accessToken) throw new Error("authenticated Supabase configuration is required");
  const headers=Object.freeze({apikey:publicKey,authorization:`Bearer ${accessToken}`});
  async function rows<T>(table:"tests"|"test_versions",query:URLSearchParams,init?:RequestInit):Promise<T[]>{
    const response=await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${query}`,{...init,headers:{...headers,accept:"application/json",...(init?.body?{"content-type":"application/json"}:{}),...(init?.headers??{})},cache:"no-store"});
    if(response.status===401) throw new PrototypeImportError("data_request_failed",401); if(response.status===403) throw new PrototypeImportError("permission_denied",403); if(!response.ok) throw new PrototypeImportError("data_request_failed",502); const text=await response.text(); return text.trim()?JSON.parse(text) as T[]:[];
  }
  async function getTest(testId:string){ testId=requiredTestId(testId); const r=await rows<TestRow>("tests",new URLSearchParams({id:`eq.${testId}`,select:"id,workspace_id",limit:"1"})); if(!r[0]) throw new PrototypeImportError("test_not_found",404); return r[0]; }
  const select="id,workspace_id,test_id,version_no,lifecycle_status,target_provider,target_snapshot,figma_file_key,figma_start_node_id,prototype_mapping";
  async function findDraft(testId:string){ const r=await rows<VersionRow>("test_versions",new URLSearchParams({test_id:`eq.${requiredTestId(testId)}`,lifecycle_status:"eq.draft",select,order:"version_no.desc",limit:"1"})); return r[0]??null; }
  async function getDraft(testId:string):Promise<DraftPrototypeVersion|null>{ const test=await getTest(testId); const draft=await findDraft(testId); if(!draft)return null; const target=targetFromRow(draft); if(!target)return null; return Object.freeze({id:draft.id,workspaceId:test.workspace_id,testId:test.id,versionNo:draft.version_no,target}); }
  async function saveDraft(testId:string,input:{url:string;ownership?:"owned"|"external";environment?:"uat"|"production"}):Promise<DraftPrototypeVersion>{
    const test=await getTest(testId); let target:TestTargetSnapshotV1; try{target=preflightTestTarget(input);}catch(error){throw new PrototypeImportError("invalid_prototype_url",400,error instanceof Error?error.message:"invalid_prototype_url");}
    const draft=await findDraft(testId); const figma=target.provider==="figma_prototype"; const cfg=target.providerConfig as Record<string,unknown>; const legacy={provider:figma?"figma":target.provider,schemaVersion:1,sourceUrl:target.sourceUrl,...(figma?{embedUrl:cfg.embedUrl,fileKey:cfg.fileKey,nodeId:cfg.nodeId,startingPointNodeId:cfg.startNodeId}:{})};
    const payload={target_provider:target.provider,target_snapshot:target,provider:figma?"figma":target.provider,figma_file_key:figma?cfg.fileKey:null,figma_start_node_id:figma?(cfg.startNodeId??cfg.nodeId??null):null,figma_version_id:null,prototype_mapping:legacy};
    if(draft){const u=await rows<VersionRow>("test_versions",new URLSearchParams({id:`eq.${draft.id}`,lifecycle_status:"eq.draft",select}),{method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify(payload)});if(!u[0])throw new PrototypeImportError("data_request_failed",502);return Object.freeze({id:u[0].id,workspaceId:test.workspace_id,testId:test.id,versionNo:u[0].version_no,target});}
    const latest=await rows<Pick<VersionRow,"version_no">>("test_versions",new URLSearchParams({test_id:`eq.${test.id}`,select:"version_no",order:"version_no.desc",limit:"1"})); const versionNo=(latest[0]?.version_no??0)+1;
    const c=await rows<VersionRow>("test_versions",new URLSearchParams({select}),{method:"POST",headers:{prefer:"return=representation"},body:JSON.stringify({workspace_id:test.workspace_id,test_id:test.id,version_no:versionNo,lifecycle_status:"draft",event_schema_version:"v2",...payload})});if(!c[0])throw new PrototypeImportError("data_request_failed",502);return Object.freeze({id:c[0].id,workspaceId:test.workspace_id,testId:test.id,versionNo:c[0].version_no,target});
  }
  async function preflightDraft(testId:string,requestOrigin:string):Promise<DraftPrototypeVersion>{
    const test=await getTest(testId);
    const draft=await findDraft(testId);
    if(!draft) throw new PrototypeImportError("target_preflight_failed",409,"draft_target_required");
    const current=targetFromRow(draft);
    if(!current) throw new PrototypeImportError("target_preflight_failed",409,"target_snapshot_required");

    let approved:TestTargetSnapshotV1;
    try{approved=approveInternalFirstPartyTarget(current,requestOrigin);}
    catch{throw new PrototypeImportError("target_preflight_failed",409,"approved_internal_target_required");}

    let live:Response;
    try{
      live=await fetchImpl(approved.sourceUrl,{
        method:"GET",
        headers:{accept:"text/html"},
        redirect:"manual",
        cache:"no-store",
      });
    }catch{
      throw new PrototypeImportError("target_preflight_failed",409,"target_unreachable");
    }
    if(
      !live.ok ||
      live.headers.get("x-utp-first-party-bridge")!==FIRST_PARTY_BRIDGE_VERSION ||
      !(live.headers.get("content-type")??"").toLowerCase().includes("text/html")
    ){
      throw new PrototypeImportError("target_preflight_failed",409,"approved_bridge_not_verified");
    }

    const payload={
      target_provider:approved.provider,
      target_snapshot:approved,
      provider:approved.provider,
      prototype_mapping:{
        ...draft.prototype_mapping,
        provider:approved.provider,
        schemaVersion:1,
        sourceUrl:approved.sourceUrl,
        capabilities:approved.capabilities,
        bridgeVersion:FIRST_PARTY_BRIDGE_VERSION,
      },
    };
    const updated=await rows<VersionRow>(
      "test_versions",
      new URLSearchParams({id:`eq.${draft.id}`,lifecycle_status:"eq.draft",select}),
      {method:"PATCH",headers:{prefer:"return=representation"},body:JSON.stringify(payload)},
    );
    if(!updated[0]) throw new PrototypeImportError("data_request_failed",502);
    return Object.freeze({
      id:updated[0].id,
      workspaceId:test.workspace_id,
      testId:test.id,
      versionNo:updated[0].version_no,
      target:approved,
    });
  }

  return Object.freeze({getDraft,saveDraft,preflightDraft});
}
