/**
 * Nexus Frontend - API Client Service
 * Connects frontend UI to backend endpoints (/api/chat, /api/health, /api/database/*)
 * Exclusively configured for Google Gemini streaming.
 */

const NexusClientAPI = {
  currentAbortController: null,

  async checkBackendHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend server unreachable:', err);
      return null;
    }
  },

  async getDatabaseStatus() {
    try {
      const res = await fetch('/api/database/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { configured: false, error: err.message };
    }
  },

  async testDatabaseConnection(url, key) {
    try {
      const res = await fetch('/api/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, key })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async getSupabaseChats() {
    try {
      const res = await fetch('/api/database/chats');
      if (!res.ok) return [];
      const data = await res.json();
      return data.chats || [];
    } catch (err) {
      console.warn('Failed to load Supabase chats:', err);
      return [];
    }
  },

  async saveChatToDatabase(chat) {
    try {
      const res = await fetch('/api/database/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat })
      });
      return await res.json();
    } catch (err) {
      console.warn('Failed to sync chat to Supabase:', err);
      return null;
    }
  },

  async deleteChatFromDatabase(chatId) {
    try {
      const res = await fetch(`/api/database/chats/${chatId}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (err) {
      console.warn('Failed to delete chat from Supabase:', err);
      return false;
    }
  },

  stopStreaming() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      return true;
    }
    return false;
  },

  /**
   * Stream conversational AI tokens from Google Gemini via Backend SSE
   */
  async streamChat(messages, options, onToken, onComplete, onError) {
    this.stopStreaming();
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    const payload = {
      chatId: options.chatId || null,
      chatTitle: options.chatTitle || null,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      persona: options.persona || 'core',
      model: options.geminiModel || 'gemini-1.5-flash',
      geminiApiKey: options.geminiApiKey || '',
      temperature: options.temperature || 0.7,
      systemPrompt: options.systemPrompt || ''
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server API Error (${response.status}): ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token) {
                onToken(parsed.token);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {}
          }
        }
      }

      this.currentAbortController = null;
      if (onComplete) onComplete();
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) {
        if (onComplete) onComplete(' [Stopped]');
      } else {
        console.error('Gemini Stream Failed:', err);
        if (onError) onError(err);
      }
      this.currentAbortController = null;
    }
  }
};

window.NexusClientAPI = NexusClientAPI;
