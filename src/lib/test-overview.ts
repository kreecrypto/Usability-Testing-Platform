import { CrudProviderError, type TestRow } from './project-test-crud.ts';
export type StudyVersion = { id: string; version_no: number; lifecycle_status: string; study_mode: 'usability' | 'methods' | 'mixed' };
export function createTestOverviewReader(options: { url: string; key: string; token: string; fetchImpl?: typeof fetch }) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = { apikey: options.key, authorization: `Bearer ${options.token}`, prefer: 'count=exact' };
  async function read(table: string, params: URLSearchParams) {
    const response = await fetchImpl(`${options.url}/rest/v1/${table}?${params}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new CrudProviderError(response.status);
    return response;
  }
  async function versions(test: TestRow): Promise<StudyVersion[]> {
    // Page every visible version: PostgREST's server row cap must never silently
    // turn version history into a partial list.
    const rows: StudyVersion[] = []; let offset = 0;
    while (true) {
      const response = await read('test_versions', new URLSearchParams({test_id:`eq.${test.id}`,workspace_id:`eq.${test.workspace_id}`,select:'id,version_no,lifecycle_status,study_mode',order:'version_no.desc,id.desc',offset:String(offset),limit:'100'}));
      const batch = await response.json() as StudyVersion[]; rows.push(...batch);
      const total = response.headers.get('content-range')?.split('/')[1];
      if (!total || !/^\d+$/.test(total)) throw new CrudProviderError(502,'count_unavailable');
      offset += batch.length; if (offset >= Number(total)) return rows;
      if (!batch.length) throw new CrudProviderError(502,'incomplete_history');
    }
  }
  async function participants(test: TestRow, versionId: string) {
    const membership = await read('workspace_members',new URLSearchParams({workspace_id:`eq.${test.workspace_id}`,select:'user_id,product_persona'}));
    const jwt = JSON.parse(Buffer.from(options.token.split('.')[1] ?? '', 'base64url').toString());
    const member = (await membership.json() as { user_id: string; product_persona: string }[]).find(row=>row.user_id===jwt.sub);
    if (!member || !['researcher','designer'].includes(member.product_persona)) return { availability: 'restricted', started: null, completed: null };
    async function count(status?: string) {
      const params = new URLSearchParams({workspace_id:`eq.${test.workspace_id}`,test_version_id:`eq.${versionId}`,select:'id',limit:'1'});
      if(status) params.set('status',`eq.${status}`);
      const response=await read('sessions',params);
      const total=response.headers.get('content-range')?.split('/')[1];
      if (!total || !/^\d+$/.test(total)) throw new CrudProviderError(502,'count_unavailable');
      return Number(total);
    }
    const [started,completed]=await Promise.all([count(),count('completed')]);
    return {availability:'available',started,completed};
  }
  return { versions, participants };
}
