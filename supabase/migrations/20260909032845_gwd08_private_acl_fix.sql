revoke execute on all functions in schema private from authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function private.is_research_editor(uuid) to authenticated, service_role;
grant execute on function private.can_read_sensitive_workspace(uuid) to authenticated, service_role;
grant execute on function private.can_read_session(uuid) to authenticated, service_role;
grant execute on function private.can_edit_finding(uuid) to authenticated, service_role;
grant execute on function private.can_read_finding_evidence(uuid) to authenticated, service_role;
