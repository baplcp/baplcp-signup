/**
 * api.js — 與 Supabase 後端溝通的統一入口
 *
 * 使用前需要：
 * 1. 在 HTML 頁面加入 Supabase CDN：
 *    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * 2. 將下方 SUPABASE_URL 和 SUPABASE_ANON_KEY 換成專案的實際值
 */

const SUPABASE_URL = 'https://rkmxoqopptyuqhbeswqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbXhvcW9wcHR5dXFoYmVzd3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODU1NzMsImV4cCI6MjA5MjA2MTU3M30.r_Mows0iPF_FULtFJGCQctxERy8E5JCIndyD-llDbIA';

const _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const api = {

  /* ── 活動 ───────────────────────────────────────────── */

  async getActivities() {
    // const { data, error } = await supabase.from('activities').select('*').order('date', { ascending: false });
    // if (error) throw error;
    // return data;
  },

  async getActivity(id) {
    // const { data, error } = await supabase.from('activities').select('*').eq('id', id).single();
    // if (error) throw error;
    // return data;
  },

  async createActivity(payload) {
    const { data, error } = await _client.from('activities').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  /* ── 報名 ───────────────────────────────────────────── */

  async getSignups(activityId) {
    // const { data, error } = await supabase.from('signups').select('*').eq('activity_id', activityId);
    // if (error) throw error;
    // return data;
  },

  async createSignup(payload) {
    // const { data, error } = await supabase.from('signups').insert(payload).select().single();
    // if (error) throw error;
    // return data;
  },

  async deleteSignup(id) {
    // const { error } = await supabase.from('signups').delete().eq('id', id);
    // if (error) throw error;
  },

  /* ── 使用者 ─────────────────────────────────────────── */

  async getCurrentUser() {
    // const { data: { user }, error } = await supabase.auth.getUser();
    // if (error) throw error;
    // return user;
  },

};
