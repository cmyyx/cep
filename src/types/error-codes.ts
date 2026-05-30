/**
 * All known API error codes.
 *
 * Every code MUST have a corresponding entry in getErrorI18nKey()'s mapping
 * table.  If you add a new code here, TypeScript will force you to add the
 * mapping — you cannot forget.
 *
 * Codes marked "backend" are returned in the JSON response body
 * `{ error: "..." }`.  Codes marked "client" are thrown by api.ts itself
 * (not from the backend).
 */

export type ApiErrorCode =
  // ── Auth (backend) ──
  | 'unauthorized'
  | 'missing_credentials'
  | 'invalid_credentials'
  | 'account_disabled'
  | 'invalid_username'
  | 'invalid_email'
  | 'weak_password'
  | 'username_taken'
  | 'email_taken'
  | 'turnstile_verification_failed'
  | 'turnstile_required'
  | 'email_domain_unsupported'
  | 'unknown_error'
  | 'invalid_or_expired_token'
  | 'invalid_session'

  // ── Account / Email (backend) ──
  | 'email_already_verified'
  | 'missing_email'
  | 'rate_limit_exceeded'
  | 'send_failed'
  | 'missing_code'
  | 'invalid_code'
  | 'code_sent_recently'
  | 'no_email'
  | 'missing_refresh_token'
  | 'token_rotation_failed'
  | 'user_not_found'

  // ── Password (backend) ──
  | 'missing_fields'
  | 'invalid_current_password'
  | 'invalid_or_expired_code'
  | 'reset_failed'

  // ── Sessions (backend) ──
  | 'invalid_session_id'
  | 'cannot_revoke_current_session'
  | 'session_not_found'

  // ── Payment (backend) ──
  | 'invalid_channel'
  | 'merchant_order_no_required_for_alipay'
  | 'reference_too_long'
  | 'merchant_order_no_too_long'
  | 'invalid_paid_time_format'

  // ── Sync (backend) ──
  | 'payload_too_large'
  | 'invalid_json'
  | 'version_conflict'
  | 'invalid_base_version'
  | 'invalid_payload_structure'
  | 'unsupported_schema_version'
  | 'invalid_captured_at'
  | 'invalid_selected_weapon_ids'
  | 'selected_weapon_ids_limit_exceeded'
  | 'invalid_dungeon_s1_selections'
  | 'dungeon_s1_selections_limit_exceeded'
  | 'weapon_ownership_limit_exceeded'
  | 'essence_status_limit_exceeded'
  | 'weapon_notes_limit_exceeded'
  | 'invalid_custom_weapons'
  | 'custom_weapons_not_allowed'
  | 'custom_weapons_limit_exceeded'
  | 'invalid_custom_weapon_name'
  | 'invalid_custom_weapon_rarity'

  // ── Global (backend) ──
  | 'maintenance_mode'
  | 'internal_server_error'
  | 'not_found'

  // ── OAuth (backend) ──
  | 'invalid_client'
  | 'invalid_state'
  | 'invalid_grant'
  | 'invalid_token'
  | 'invalid_request'
  | 'unsupported_grant_type'
  | 'missing_oauth_params'

  // ── Email service (backend) ──
  | 'email_send_failed'
  | 'smtp_config_invalid'

  // ── Redeem (backend) ──
  | 'code_expired'
  | 'code_already_used'
  | 'code_revoked'
  | 'code_belongs_to_other'
  | 'invalid_days'
  | 'invalid_count'
  | 'invalid_expiry'
  | 'insufficient_permission'

  // ── Client-side (thrown by api.ts itself, not from backend) ──
  | 'invalid_response'
  | 'auth_unavailable'
  | 'network_error'
