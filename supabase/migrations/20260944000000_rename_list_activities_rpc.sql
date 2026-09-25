-- 縮短公開 RPC 名稱；ALTER FUNCTION 會保留既有實作與執行權限。
alter function public.list_group_activity_sessions(
  text,
  integer,
  timestamptz,
  date,
  timestamptz,
  bigint
) rename to list_activities;
