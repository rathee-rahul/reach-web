let realtimeClient = null;
let realtimeChannel = null;

function stopRealtime() {
  if (realtimeClient && realtimeChannel) {
    realtimeClient.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

function subscribeToChat(chatId, onChange) {
  stopRealtime();
  if (!window.supabase || !chatId) return;
  const { createClient } = window.supabase;
  realtimeClient = realtimeClient || createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  realtimeChannel = realtimeClient
    .channel(`messages:${chatId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, onChange)
    .subscribe();
}

window.addEventListener("hashchange", stopRealtime);
