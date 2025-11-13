# Supabase Migrations Audit

## Summary
- Compared local files in `supabase/migrations/` with the Supabase project migrations history.
- Marked each local file as Keep or Delete based on whether its `version` exists in remote history and consistency with the live schema.

## Keep
- 20251012110915_drop_all_tables.sql
- 20251012111821_drop_postgis_extension.sql
- 20251012114523_create_profiles_table.sql
- 20251012120727_create_social_links_table.sql
- 20251012120759_create_posts_table.sql
- 20251012120834_create_storage_buckets.sql
- 20251012133943_create_feedback_table.sql
- 20251012133957_create_feedback_storage_bucket.sql
- 20251012135030_remove_feedback_status_column.sql
- 20251013143303_create_locations_table.sql
- 20251013165442_create_conversations_table.sql
- 20251013165458_create_messages_table.sql
- 20251013174633_insert_dummy_data_corrected.sql
- 20251021113116_restore_conversation_messaging_fixed_v3.sql
- 20251021120114_simplify_messaging_system_v3.sql
- 20251021145000_direct_messaging.sql
- 20251110160030_optimize_rls_policies_performance.sql
- 20251110160057_cleanup_unused_indexes.sql
- 20251111151722_add_message_broadcast_trigger.sql

## Delete
- 20250101000000_initial_schema.sql (not present in remote history)
- 20250101000001_storage_buckets.sql (not present; superseded by 20251012120834)
- 20250101000002_seed_data_optional.sql (not present in remote history)
- 20251012120001_create_social_links_table.sql (duplicate older timestamp; not present)
- 20251012120002_create_posts_table.sql (duplicate older timestamp; not present)
- 20251012120003_create_storage_buckets.sql (duplicate older timestamp; not present)
- 20251018190000_add_message_status_and_unread.sql (remote uses 20251018181355)
- 20251020153000_reconcile_conversations_anonymity_and_messages_image.sql (remote version is 20251020161843)
- 20251021131000_remove_image_url_from_messages.sql (remote version is 20251021052725)
- 20251021153000_fix_messaging_complete.sql (not present in remote history)
- 20251021210000_restore_conversation_messaging.sql (not present in remote history)
- 20251110000000_fix_rls_performance_and_security.sql (not present in remote history)

## Recommendation
- Remove the files under Delete to align the repo with the Supabase project’s actual migration history.
- If future CLI workflows need migrations, consider creating a single baseline migration capturing the current schema after cleanup.
