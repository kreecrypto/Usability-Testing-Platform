import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

const jsonHeaders = { "content-type": "application/json" };

type Json = Record<string, unknown> | Array<unknown>;

async function callJson(url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { nonJson: true };
    }
  }
  return { status: response.status, body };
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secret) {
    return Response.json(
      { ok: false, stage: "env", hasUrl: Boolean(supabaseUrl), hasSecret: Boolean(secret) },
      { status: 503 },
    );
  }

  const authHeaders = {
    ...jsonHeaders,
    apikey: secret,
    authorization: `Bearer ${secret}`,
  };
  const restHeaders = {
    ...authHeaders,
    prefer: "return=representation",
  };

  const userIdHolder: { id?: string } = {};
  const ids = {
    workspaceId: randomUUID(),
    projectId: randomUUID(),
    testId: randomUUID(),
    testVersionId: randomUUID(),
    participantId: randomUUID(),
    sessionId: randomUUID(),
    eventId: randomUUID(),
  };

  async function restInsert(table: string, row: Json) {
    const result = await callJson(`${supabaseUrl}/rest/v1/${table}`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify(row),
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`insert_${table}_${result.status}`);
    }
  }

  async function restDelete(table: string, filter: string) {
    await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: authHeaders,
    });
  }

  try {
    const email = `task22-${randomUUID()}@example.invalid`;
    const createUser = await callJson(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        email,
        password: `QATask22!${randomUUID()}`,
        email_confirm: true,
      }),
    });
    if (createUser.status < 200 || createUser.status >= 300) {
      return Response.json({ ok: false, stage: "create_user", status: createUser.status }, { status: 500 });
    }
    const createdUser = createUser.body as { id?: string };
    if (!createdUser?.id) {
      return Response.json({ ok: false, stage: "create_user_shape" }, { status: 500 });
    }
    userIdHolder.id = createdUser.id;

    await restInsert("users", {
      id: createdUser.id,
      display_name: "Task 22 Runtime QA",
    });
    await restInsert("workspaces", {
      id: ids.workspaceId,
      name: "Task 22 Runtime QA",
      slug: `task22-qa-${ids.workspaceId.slice(0, 8)}`,
      owner_user_id: createdUser.id,
    });
    await restInsert("projects", {
      id: ids.projectId,
      workspace_id: ids.workspaceId,
      name: "Task 22 Runtime QA",
      created_by: createdUser.id,
    });
    await restInsert("tests", {
      id: ids.testId,
      workspace_id: ids.workspaceId,
      project_id: ids.projectId,
      title: "Task 22 Runtime QA",
      created_by: createdUser.id,
    });
    await restInsert("test_versions", {
      id: ids.testVersionId,
      workspace_id: ids.workspaceId,
      test_id: ids.testId,
      version_no: 1,
      lifecycle_status: "published",
      provider: "figma",
      event_schema_version: 2,
      published_at: new Date().toISOString(),
      created_by: createdUser.id,
    });
    await restInsert("participants", {
      id: ids.participantId,
      workspace_id: ids.workspaceId,
      test_id: ids.testId,
    });
    await restInsert("sessions", {
      id: ids.sessionId,
      workspace_id: ids.workspaceId,
      test_id: ids.testId,
      test_version_id: ids.testVersionId,
      participant_id: ids.participantId,
      status: "active",
      consent_version: "qa-v1",
      consented_at: new Date().toISOString(),
    });

    const origin = new URL(request.url).origin;
    const eventPayload = {
      schemaVersion: 2,
      eventId: ids.eventId,
      idempotencyKey: `task22-${ids.eventId}`,
      eventType: "session_started",
      occurredAt: new Date().toISOString(),
      sessionId: ids.sessionId,
      participantId: ids.participantId,
      testId: ids.testId,
      testVersionId: ids.testVersionId,
      eventLayer: "raw",
      source: "runner",
      sequence: 1,
      metadata: { qa: "task22-runtime" },
    };

    const accepted = await callJson(`${origin}/v1/events`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(eventPayload),
    });

    const eventQuery = await callJson(
      `${supabaseUrl}/rest/v1/events?event_id=eq.${ids.eventId}&select=event_id,workspace_id,session_id,participant_id,test_id,test_version_id,event_name,received_at`,
      { method: "GET", headers: authHeaders },
    );
    const rows = Array.isArray(eventQuery.body) ? eventQuery.body : [];

    const malformed = await callJson(`${origin}/v1/events`, {
      method: "POST",
      headers: jsonHeaders,
      body: "{}",
    });

    const secretLeaked = JSON.stringify({ accepted: accepted.body, malformed: malformed.body }).includes(secret);

    return Response.json({
      ok: accepted.status === 202 && rows.length === 1 && malformed.status >= 400 && !secretLeaked,
      acceptedStatus: accepted.status,
      persistedRows: rows.length,
      malformedStatus: malformed.status,
      secretLeaked,
      persistedContextMatches:
        rows.length === 1 &&
        (rows[0] as Record<string, unknown>).workspace_id === ids.workspaceId &&
        (rows[0] as Record<string, unknown>).session_id === ids.sessionId,
    });
  } catch (error) {
    return Response.json(
      { ok: false, stage: "runtime", error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  } finally {
    await restDelete("events", `event_id=eq.${ids.eventId}`);
    await restDelete("sessions", `id=eq.${ids.sessionId}`);
    await restDelete("participants", `id=eq.${ids.participantId}`);
    await restDelete("test_versions", `id=eq.${ids.testVersionId}`);
    await restDelete("tests", `id=eq.${ids.testId}`);
    await restDelete("projects", `id=eq.${ids.projectId}`);
    await restDelete("workspaces", `id=eq.${ids.workspaceId}`);
    if (userIdHolder.id) {
      await restDelete("users", `id=eq.${userIdHolder.id}`);
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userIdHolder.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
    }
  }
}
