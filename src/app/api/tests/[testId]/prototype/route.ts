import { accessTokenFromRequest, publicSupabaseConfig } from "../../../../../lib/auth/session.ts";
import { createDraftPrototypeStore, PrototypeImportError } from "../../../../../lib/builder/prototype-import.ts";

export const runtime="nodejs"; export const dynamic="force-dynamic";
type Context={params:Promise<{testId:string}>};
function json(body:unknown,status:number){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store"}});}
function storeForRequest(request:Request){const accessToken=accessTokenFromRequest(request);if(!accessToken)return null;const config=publicSupabaseConfig();return createDraftPrototypeStore({supabaseUrl:config.url,publicKey:config.key,accessToken});}
function errorResponse(error:unknown){if(error instanceof PrototypeImportError){if(error.status===401)return json({error:"authentication_required"},401);return json({error:error.code,message:error.message},error.status);}return json({error:"data_request_failed"},502);}
export async function GET(request:Request,context:Context){try{const store=storeForRequest(request);if(!store)return json({error:"authentication_required"},401);const {testId}=await context.params;return json({draft:await store.getDraft(testId)},200);}catch(error){return errorResponse(error);}}
export async function PUT(request:Request,context:Context){let body:unknown;try{body=await request.json();}catch{return json({error:"invalid_json"},400);}if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"invalid_body"},400);try{const store=storeForRequest(request);if(!store)return json({error:"authentication_required"},401);const {testId}=await context.params;const b=body as Record<string,unknown>;const url=String(b.targetUrl??b.prototypeUrl??"");const ownership=b.ownership==="owned"?"owned":b.ownership==="external"?"external":undefined;const environment=b.environment==="uat"?"uat":b.environment==="production"?"production":undefined;const draft=await store.saveDraft(testId,{url,ownership,environment});return json({draft},200);}catch(error){return errorResponse(error);}}

export async function POST(request:Request,context:Context){
  try{
    const store=storeForRequest(request);
    if(!store)return json({error:"authentication_required"},401);
    const {testId}=await context.params;
    const requestOrigin=new URL(request.url).origin;
    return json({draft:await store.preflightDraft(testId,requestOrigin)},200);
  }catch(error){return errorResponse(error);}
}
