import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRunnerJson,RunnerRequestError,invalidParticipantLink} from '../src/lib/runner/access.ts';
test('participant access preserves HTTP status and only classifies known invalid links',async()=>{
 for(const [status,code,invalid] of [[400,'invalid_version_id',true],[400,'invalid_consent',false],[404,'published_test_not_found',true],[410,'expired',true],[401,'unauthorized',false],[403,'forbidden',false],[500,'data_request_failed',false],[503,'unavailable',false]] as const){
  await assert.rejects(readRunnerJson(new Response(JSON.stringify({error:code}),{status})),error=>{
   assert.ok(error instanceof RunnerRequestError);assert.equal(error.status,status);assert.equal(error.code,code);assert.equal(invalidParticipantLink(error),invalid);return true;
  });
 }
 assert.equal(invalidParticipantLink(new TypeError('network')),false);
});
test('malformed successful JSON is a recoverable response failure, never an invalid link',async()=>{
 await assert.rejects(readRunnerJson(new Response('broken',{status:200})),error=>{
  assert.ok(error instanceof RunnerRequestError);assert.equal(error.code,'invalid_response');assert.equal(invalidParticipantLink(error),false);return true;
 });
 assert.deepEqual(await readRunnerJson(new Response('{"test":{"testVersionId":"qa"}}')),{test:{testVersionId:'qa'}});
});
