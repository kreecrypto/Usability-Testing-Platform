import { accessTokenFromRequest, publicSupabaseConfig } from '../../../../../lib/auth/session.ts';
import { crudForRequest, crudErrorResponse, jsonResponse } from '../../../../../lib/project-test-api.ts';
import { createTestOverviewReader } from '../../../../../lib/test-overview.ts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request: Request, context: {params:Promise<{testId:string}>}) {
  try {
    const crud=crudForRequest(request);
    const test=await crud.getTest((await context.params).testId);
    if(!test) return jsonResponse({error:'not_found'},404);
    const project=await crud.getProject(test.project_id);
    if(!project) return jsonResponse({error:'not_found'},404);
    const config=publicSupabaseConfig();
    const reader=createTestOverviewReader({url:config.url,key:config.key,token:accessTokenFromRequest(request)!});
    const versions=await reader.versions(test);
    const requested=new URL(request.url).searchParams.get('versionId');
    const selected=requested ? versions.find(v=>v.id===requested) : versions.find(v=>v.lifecycle_status==='published') ?? versions.find(v=>v.lifecycle_status==='draft');
    if(requested && !selected) return jsonResponse({error:'version_not_found'},404);
    let participants: {availability:string;started:number|null;completed:number|null}={availability:'no_data',started:null,completed:null};
    if(selected?.lifecycle_status==='published') {
      try {participants=await reader.participants(test,selected.id);} catch {participants={availability:'unavailable',started:null,completed:null};}
    }
    return jsonResponse({test,project,versions,selectedVersionId:selected?.id??null,participants});
  } catch(error) {return crudErrorResponse(error);}
}
