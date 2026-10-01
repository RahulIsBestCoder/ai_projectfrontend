/** Remove conversations saved by older versions. New chats stay in component state. */
export function clearLegacyChatHistory() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem('ai_chat_session_history');
  } catch {
    // Chat also works when browser storage is blocked.
  }
}
