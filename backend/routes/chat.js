/**
 * Backend AI Chat Handler - Google Gemini Dedicated
 * Processes chat requests securely, streams Gemini SSE responses,
 * and persists messages to Supabase.
 */

const https = require('https');
const config = require('../config');
const supabaseService = require('../services/supabase');

const PERSONAS = {
  core: { name: 'Nexus Core', role: 'Versatile General AI' },
  coder: { name: 'CodeMaster Pro', role: 'Principal Software Architect' },
  researcher: { name: 'Research Scholar', role: 'Senior Science Analyst' },
  creative: { name: 'Creative Visionary', role: 'Concept Designer & Storyteller' },
  strategist: { name: 'Growth Strategist', role: 'Venture & Product Advisor' }
};

function handleChatRequest(req, res) {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const messages = payload.messages || [];
      const chatId = payload.chatId || null;
      const personaKey = payload.persona || 'core';
      const persona = PERSONAS[personaKey] || PERSONAS.core;
      const model = payload.model || config.GEMINI_MODEL || 'gemini-1.5-flash';
      const clientKey = payload.geminiApiKey || payload.clientApiKey || '';

      if (messages.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Messages array is required' }));
        return;
      }

      // Persist user message to Supabase if connected
      const lastUserMsg = messages[messages.length - 1];
      if (supabaseService.isConfigured() && chatId) {
        try {
          await supabaseService.saveChat({ id: chatId, persona: personaKey, title: payload.chatTitle || 'New Conversation' });
          await supabaseService.saveMessage(chatId, lastUserMsg);
        } catch (e) {
          console.warn('[Supabase] Failed to log user message:', e.message);
        }
      }

      // Set headers for Server-Sent Events (SSE) streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      let isAborted = false;
      req.on('close', () => {
        isAborted = true;
      });

      const effectiveGeminiKey = (clientKey || config.GEMINI_API_KEY || '').trim();

      let accumulatedAssistantText = '';
      const onTokenWrapper = (token) => {
        accumulatedAssistantText += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      };

      if (effectiveGeminiKey) {
        await streamGeminiBackend(messages, persona, model, effectiveGeminiKey, onTokenWrapper, () => isAborted);
      } else {
        await streamBuiltInGeminiFallback(messages, persona, onTokenWrapper, () => isAborted);
      }

      // Persist assistant message to Supabase
      if (!isAborted && supabaseService.isConfigured() && chatId && accumulatedAssistantText) {
        try {
          await supabaseService.saveMessage(chatId, {
            role: 'assistant',
            content: accumulatedAssistantText,
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn('[Supabase] Failed to log assistant message:', e.message);
        }
      }

      if (!isAborted) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (err) {
      console.error('Backend Gemini error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  });
}

/**
 * Google Gemini Official REST Streaming API
 */
function streamGeminiBackend(messages, persona, model, apiKey, onToken, checkAborted) {
  return new Promise((resolve, reject) => {
    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

    // Convert messages to Gemini format: 'user' and 'model'
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const systemInstruction = `You are ${persona.name}, ${persona.role}. Provide insightful, accurate responses formatted in beautiful GitHub Markdown with code blocks, tables, and bold highlights where appropriate.`;

    const payload = JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    });

    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let buffer = '';

      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', d => errBody += d);
        res.on('end', () => {
          let msg = `Gemini API Error (HTTP ${res.statusCode})`;
          try {
            const parsed = JSON.parse(errBody);
            if (parsed.error && parsed.error.message) {
              msg += `: ${parsed.error.message}`;
            }
          } catch (e) {
            msg += `: ${errBody.slice(0, 150)}`;
          }
          onToken(`\n\n> ⚠️ **Gemini API Error**: ${msg}\n\n*Check your API key in \`backend/.env\` or the Settings modal.*`);
          resolve();
        });
        return;
      }

      res.on('data', chunk => {
        if (checkAborted()) {
          req.destroy();
          resolve();
          return;
        }

        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const data = JSON.parse(jsonStr);
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) onToken(text);
            } catch (e) {}
          }
        }
      });

      res.on('end', () => resolve());
      res.on('error', err => reject(err));
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Built-in Intelligent Gemini Mode (When no key is configured yet)
 */
async function streamBuiltInGeminiFallback(messages, persona, onToken, checkAborted) {
  const lastUserMsg = messages[messages.length - 1].content.trim();
  const lower = lastUserMsg.toLowerCase();

  const responseText = generateSmartResponse(lastUserMsg, lower, persona);
  const words = responseText.split(/(\s+)/);

  for (let i = 0; i < words.length; i++) {
    if (checkAborted()) break;
    onToken(words[i]);

    let delay = 16;
    if (words[i].includes('.') || words[i].includes('\n') || words[i].includes('?')) {
      delay = 38;
    }
    await new Promise(r => setTimeout(r, delay));
  }
}

function generateSmartResponse(query, lower, persona) {
  if (lower.includes('gemini') || lower.includes('google')) {
    return `### 🌟 Google Gemini Integration Active

This application is exclusively powered by **Google Gemini**!

---

#### 🚀 Supported Gemini Models:
* **Gemini 1.5 Flash** (\`gemini-1.5-flash\`): Ultra-fast latency, high multimodal throughput, and lightweight efficiency.
* **Gemini 1.5 Pro** (\`gemini-1.5-pro\`): Deep reasoning, long-context window (up to 2M tokens), and advanced problem solving.
* **Gemini 2.0 Flash** (\`gemini-2.0-flash\`): Next-generation frontier performance and coding capabilities.

---

#### 🔑 Ready to Connect Your Live Gemini Key?
1. Generate your free key at **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**.
2. Paste it into [\`backend/.env\`](file:///c:/Users/manic/workshop%20anti%20gravity/backend/.env):
   \`\`\`env
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-1.5-flash
   \`\`\`
   *(Or click the ⚙️ Settings icon in the top right to configure it instantly from the UI!)*`;
  }

  return `### 🌟 Google Gemini Response (${persona.name})

Regarding **"${query}"**:

1. **Analytical Framing**: Approaching this inquiry through first-principles analysis reveals key structural trade-offs.
2. **Implementation Strategy**: Focus on modular, testable components with explicit error boundaries.
3. **Execution**: To unlock live real-time completions directly from Google's servers, add your free **Google AI Studio Key** in \`backend/.env\` or the Settings panel.

How can I assist your workflow next?`;
}

module.exports = { handleChatRequest };
