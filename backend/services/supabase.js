/**
 * Backend Supabase Service
 * Connects to Supabase PostgreSQL Database using @supabase/supabase-js
 * Handles persistence for conversations, messages, and schema validation.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class SupabaseService {
  constructor() {
    this.client = null;
    this.url = config.SUPABASE_URL;
    this.key = config.SUPABASE_KEY;

    if (this.url && this.key) {
      this.initClient(this.url, this.key);
    }
  }

  initClient(url, key) {
    try {
      this.url = url.trim();
      this.key = key.trim();
      this.client = createClient(this.url, this.key, {
        auth: { persistSession: false }
      });
      console.log(`[Supabase] Client initialized for project: ${this.url}`);
      return true;
    } catch (err) {
      console.error('[Supabase] Initialization failed:', err.message);
      this.client = null;
      return false;
    }
  }

  isConfigured() {
    return Boolean(this.client && this.url && this.key);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      url: this.url ? this.url.replace(/(https?:\/\/)([^.]+)(\..*)/, '$1$2***$3') : null,
      hasKey: Boolean(this.key)
    };
  }

  // Verify connection by querying the chats table
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Supabase credentials are not configured in backend/.env'
      };
    }

    try {
      const { data, error } = await this.client
        .from('chats')
        .select('id')
        .limit(1);

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          return {
            success: false,
            tableMissing: true,
            message: "Connected to Supabase, but the 'chats' table was not found. Please run backend/supabase_schema.sql in your Supabase SQL Editor."
          };
        }
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: 'Successfully connected to Supabase PostgreSQL database!'
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // Fetch all chats
  async getChats() {
    if (!this.isConfigured()) return [];

    const { data: chats, error } = await this.client
      .from('chats')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Failed to fetch chats:', error.message);
      return [];
    }
    return chats || [];
  }

  // Fetch a chat and its messages
  async getChatMessages(chatId) {
    if (!this.isConfigured()) return [];

    const { data: messages, error } = await this.client
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Supabase] Failed to fetch messages:', error.message);
      return [];
    }
    return messages || [];
  }

  // Upsert chat record
  async saveChat(chat) {
    if (!this.isConfigured()) return null;

    const payload = {
      id: chat.id,
      title: chat.title || 'New Conversation',
      persona: chat.persona || 'core',
      pinned: Boolean(chat.pinned),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.client
      .from('chats')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.warn('[Supabase] Save chat failed:', error.message);
      return null;
    }
    return data;
  }

  // Save message
  async saveMessage(chatId, message) {
    if (!this.isConfigured()) return null;

    const payload = {
      id: message.id || ('msg_' + Date.now()),
      chat_id: chatId,
      role: message.role,
      content: message.content,
      created_at: new Date(message.timestamp || Date.now()).toISOString()
    };

    const { data, error } = await this.client
      .from('messages')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.warn('[Supabase] Save message failed:', error.message);
      return null;
    }

    // Touch chat updated_at
    await this.client
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    return data;
  }

  // Delete chat
  async deleteChat(chatId) {
    if (!this.isConfigured()) return false;

    const { error } = await this.client
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      console.warn('[Supabase] Delete chat failed:', error.message);
      return false;
    }
    return true;
  }
}

const supabaseService = new SupabaseService();
module.exports = supabaseService;
