/**
 * Nexus Frontend - Application Orchestrator
 * Connects UI interactions to Google Gemini via Backend API (/api/chat) & Supabase
 */

const NexusApp = {
  state: {
    chats: [],
    activeChatId: null,
    activePersona: 'core',
    theme: 'dark',
    isGenerating: false,
    userScrolledUp: false,
    soundEnabled: true,
    backendOnline: false,
    supabaseConnected: false
  },

  settings: {
    geminiModel: 'gemini-1.5-flash',
    geminiApiKey: '',
    temperature: 0.7,
    systemPrompt: '',
    supabaseUrl: '',
    supabaseKey: ''
  },

  personas: {
    core: { id: 'core', name: 'Nexus Core', role: 'Versatile General AI', icon: '✨', welcomeGreeting: 'Hello! I am Nexus Core, powered by Google Gemini. How can I assist you today?' },
    coder: { id: 'coder', name: 'CodeMaster Pro', role: 'Software Architect', icon: '💻', welcomeGreeting: 'CodeMaster online with Google Gemini. Ready to architect systems or write code.' },
    researcher: { id: 'researcher', name: 'Research Scholar', role: 'Science Analyst', icon: '🧠', welcomeGreeting: 'Greetings. Ready for structured breakdowns and deep analysis.' },
    creative: { id: 'creative', name: 'Creative Visionary', role: 'Concept Designer', icon: '🎨', welcomeGreeting: 'Creative forge active. Let us dream new narratives and concepts.' },
    strategist: { id: 'strategist', name: 'Growth Strategist', role: 'Product & Venture Advisor', icon: '🚀', welcomeGreeting: 'Strategy active. Let us optimize your execution and roadmaps.' }
  },

  elements: {},

  async init() {
    this.cacheElements();
    this.loadState();
    this.initCanvasBackground();
    this.bindEvents();
    this.applyTheme(this.state.theme);
    this.renderSidebar();
    this.renderChat();
    this.updatePersonaBadge();

    const health = await NexusClientAPI.checkBackendHealth();
    if (health && health.status === 'healthy') {
      this.state.backendOnline = true;
      this.updateBackendStatus(true, health);

      const dbStatus = await NexusClientAPI.getDatabaseStatus();
      this.state.supabaseConnected = dbStatus.configured;
      this.updateDatabaseBadge(dbStatus);

      if (dbStatus.configured) {
        const cloudChats = await NexusClientAPI.getSupabaseChats();
        if (cloudChats && cloudChats.length > 0) {
          this.mergeCloudChats(cloudChats);
        }
      }
    } else {
      this.updateBackendStatus(false);
    }
  },

  cacheElements() {
    this.elements = {
      sidebar: document.getElementById('sidebar'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      btnNewChat: document.getElementById('btn-new-chat'),
      searchHistoryInput: document.getElementById('search-history-input'),
      historyList: document.getElementById('sidebar-history-list'),
      personaSelectorBtn: document.getElementById('persona-selector-btn'),
      personaSelectModal: document.getElementById('persona-modal'),
      currentPersonaName: document.getElementById('current-persona-name'),
      currentPersonaRole: document.getElementById('current-persona-role'),
      currentPersonaIcon: document.getElementById('current-persona-icon'),
      modelIndicator: document.getElementById('model-indicator'),
      modelNameBadge: document.getElementById('model-name-badge'),
      backendStatusDot: document.getElementById('backend-status-dot'),
      backendStatusText: document.getElementById('backend-status-text'),
      dbBadge: document.getElementById('db-badge'),
      chatScrollArea: document.getElementById('chat-scroll-area'),
      chatContentWrapper: document.getElementById('chat-content-wrapper'),
      chatInput: document.getElementById('chat-input'),
      btnSend: document.getElementById('btn-send'),
      btnStop: document.getElementById('btn-stop'),
      btnVoiceInput: document.getElementById('btn-voice-input'),
      tokenCounter: document.getElementById('token-counter'),
      btnSettings: document.getElementById('btn-settings'),
      settingsModal: document.getElementById('settings-modal'),
      btnExport: document.getElementById('btn-export'),
      exportModal: document.getElementById('export-modal'),
      btnThemeToggle: document.getElementById('btn-theme-toggle'),
      btnSoundToggle: document.getElementById('btn-sound-toggle'),
      toastContainer: document.getElementById('toast-container'),
      canvas: document.getElementById('ambient-canvas')
    };
  },

  loadState() {
    try {
      const savedChats = localStorage.getItem('nexus_chats');
      if (savedChats) {
        this.state.chats = JSON.parse(savedChats);
      }
      const savedActive = localStorage.getItem('nexus_active_chat');
      if (savedActive && this.state.chats.some(c => c.id === savedActive)) {
        this.state.activeChatId = savedActive;
      } else if (this.state.chats.length > 0) {
        this.state.activeChatId = this.state.chats[0].id;
      } else {
        this.createNewChat(false);
      }

      const savedPersona = localStorage.getItem('nexus_persona');
      if (savedPersona && this.personas[savedPersona]) {
        this.state.activePersona = savedPersona;
      }

      const savedTheme = localStorage.getItem('nexus_theme');
      if (savedTheme) {
        this.state.theme = savedTheme;
      }

      const savedSound = localStorage.getItem('nexus_sound');
      if (savedSound !== null) {
        this.state.soundEnabled = savedSound === 'true';
        NexusAudio.soundEnabled = this.state.soundEnabled;
      }

      const savedSettings = localStorage.getItem('nexus_settings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
    } catch (e) {
      console.warn('Storage load failed:', e);
      this.createNewChat(false);
    }
  },

  saveState() {
    try {
      localStorage.setItem('nexus_chats', JSON.stringify(this.state.chats));
      localStorage.setItem('nexus_active_chat', this.state.activeChatId || '');
      localStorage.setItem('nexus_persona', this.state.activePersona);
      localStorage.setItem('nexus_theme', this.state.theme);
      localStorage.setItem('nexus_sound', String(this.state.soundEnabled));
      localStorage.setItem('nexus_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  },

  mergeCloudChats(cloudChats) {
    let updated = false;
    cloudChats.forEach(cc => {
      const existing = this.state.chats.find(c => c.id === cc.id);
      if (!existing) {
        this.state.chats.push({
          id: cc.id,
          title: cc.title,
          pinned: Boolean(cc.pinned),
          createdAt: new Date(cc.created_at).getTime() || Date.now(),
          messages: []
        });
        updated = true;
      }
    });
    if (updated) {
      this.saveState();
      this.renderSidebar();
    }
  },

  updateBackendStatus(isOnline, health = null) {
    if (this.elements.backendStatusDot) {
      this.elements.backendStatusDot.style.background = isOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)';
      this.elements.backendStatusDot.style.boxShadow = isOnline ? '0 0 10px var(--accent-emerald)' : '0 0 10px var(--accent-rose)';
    }
    if (this.elements.backendStatusText) {
      this.elements.backendStatusText.textContent = isOnline ? 'Backend Online' : 'Connecting...';
    }
  },

  updateDatabaseBadge(dbStatus) {
    const badge = this.elements.dbBadge;
    if (!badge) return;

    if (dbStatus.configured) {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;margin-right:5px;"></span>Supabase Active`;
      badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      badge.style.color = '#10b981';
      badge.title = 'Conversations syncing live to Supabase PostgreSQL';
    } else {
      badge.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b;margin-right:5px;"></span>Supabase: Connect`;
      badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      badge.style.color = '#f59e0b';
      badge.title = 'Click Settings to add your Supabase credentials';
      badge.onclick = () => {
        NexusAudio.playClickSound();
        this.populateSettingsForm();
        this.openModal(this.elements.settingsModal);
      };
    }
  },

  getActiveChat() {
    return this.state.chats.find(c => c.id === this.state.activeChatId);
  },

  createNewChat(render = true) {
    const newChat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: 'New Conversation',
      createdAt: Date.now(),
      pinned: false,
      messages: []
    };

    this.state.chats.unshift(newChat);
    this.state.activeChatId = newChat.id;
    this.saveState();
    NexusClientAPI.saveChatToDatabase(newChat);

    if (render) {
      this.renderSidebar();
      this.renderChat();
      this.elements.chatInput.focus();
    }
    return newChat;
  },

  async deleteChat(chatId, e) {
    if (e) e.stopPropagation();
    NexusAudio.playClickSound();

    this.state.chats = this.state.chats.filter(c => c.id !== chatId);
    if (this.state.activeChatId === chatId) {
      this.state.activeChatId = this.state.chats.length > 0 ? this.state.chats[0].id : null;
    }
    if (!this.state.activeChatId) {
      this.createNewChat(false);
    }
    this.saveState();
    this.renderSidebar();
    this.renderChat();

    NexusClientAPI.deleteChatFromDatabase(chatId);
    this.showToast('Conversation deleted');
  },

  renameChat(chatId, e) {
    if (e) e.stopPropagation();
    const chat = this.state.chats.find(c => c.id === chatId);
    if (!chat) return;

    const newTitle = prompt('Rename conversation:', chat.title);
    if (newTitle && newTitle.trim()) {
      chat.title = newTitle.trim();
      this.saveState();
      this.renderSidebar();
      NexusClientAPI.saveChatToDatabase(chat);
      this.showToast('Conversation renamed');
    }
  },

  togglePinChat(chatId, e) {
    if (e) e.stopPropagation();
    const chat = this.state.chats.find(c => c.id === chatId);
    if (!chat) return;
    chat.pinned = !chat.pinned;
    this.saveState();
    this.renderSidebar();
    NexusClientAPI.saveChatToDatabase(chat);
  },

  selectChat(chatId) {
    if (this.state.activeChatId === chatId) return;
    NexusAudio.playClickSound();
    this.state.activeChatId = chatId;
    this.saveState();
    this.renderSidebar();
    this.renderChat();

    if (window.innerWidth <= 900) {
      this.elements.sidebar.classList.remove('mobile-open');
      this.elements.sidebar.classList.add('mobile-closed');
    }
  },

  bindEvents() {
    this.elements.btnNewChat.addEventListener('click', () => {
      NexusAudio.playClickSound();
      this.createNewChat(true);
    });

    this.elements.btnToggleSidebar.addEventListener('click', () => {
      NexusAudio.playClickSound();
      if (window.innerWidth <= 900) {
        this.elements.sidebar.classList.toggle('mobile-open');
        this.elements.sidebar.classList.toggle('mobile-closed');
      } else {
        this.elements.sidebar.classList.toggle('collapsed');
      }
    });

    this.elements.searchHistoryInput.addEventListener('input', (e) => {
      this.renderSidebar(e.target.value.toLowerCase().trim());
    });

    this.elements.chatInput.addEventListener('input', () => {
      this.handleInputResize();
      this.updateTokenCounter();
      this.updateSendButtonState();
    });

    this.elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.elements.btnSend.addEventListener('click', () => {
      this.sendMessage();
    });

    this.elements.btnStop.addEventListener('click', () => {
      NexusAudio.playClickSound();
      NexusClientAPI.stopStreaming();
      this.setGeneratingState(false);
    });

    this.elements.btnVoiceInput.addEventListener('click', () => {
      NexusAudio.playClickSound();
      NexusAudio.toggleVoiceInput(
        (transcript, isFinal) => {
          this.elements.chatInput.value = transcript;
          this.handleInputResize();
          this.updateTokenCounter();
          this.updateSendButtonState();
          if (isFinal) {
            this.showToast('Voice transcribed');
          }
        },
        (isRecording) => {
          if (isRecording) {
            this.elements.btnVoiceInput.classList.add('recording');
            this.showToast('Listening... Speak now');
          } else {
            this.elements.btnVoiceInput.classList.remove('recording');
          }
        }
      );
    });

    this.elements.personaSelectorBtn.addEventListener('click', () => {
      NexusAudio.playClickSound();
      this.openModal(this.elements.personaSelectModal);
    });

    this.elements.btnSettings.addEventListener('click', () => {
      NexusAudio.playClickSound();
      this.populateSettingsForm();
      this.openModal(this.elements.settingsModal);
    });

    this.elements.btnExport.addEventListener('click', () => {
      NexusAudio.playClickSound();
      this.openModal(this.elements.exportModal);
    });

    this.elements.btnThemeToggle.addEventListener('click', () => {
      NexusAudio.playClickSound();
      const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(newTheme);
    });

    this.elements.btnSoundToggle.addEventListener('click', () => {
      this.state.soundEnabled = !this.state.soundEnabled;
      NexusAudio.soundEnabled = this.state.soundEnabled;
      this.updateSoundToggleIcon();
      NexusAudio.playClickSound();
      this.saveState();
      this.showToast(this.state.soundEnabled ? 'Audio cues enabled' : 'Audio cues muted');
    });

    this.elements.chatScrollArea.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.elements.chatScrollArea;
      this.state.userScrolledUp = scrollHeight - scrollTop - clientHeight >= 50;
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.createNewChat(true);
      }
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    document.querySelectorAll('.modal-close-trigger').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeAllModals();
      });
    });

    this.updateSoundToggleIcon();
  },

  handleInputResize() {
    const input = this.elements.chatInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
  },

  updateTokenCounter() {
    const text = this.elements.chatInput.value;
    const charCount = text.length;
    const estTokens = Math.ceil(charCount / 4);
    this.elements.tokenCounter.textContent = `${estTokens} tokens • ${charCount} chars`;
  },

  updateSendButtonState() {
    const hasText = this.elements.chatInput.value.trim().length > 0;
    this.elements.btnSend.disabled = !hasText || this.state.isGenerating;
  },

  applyTheme(theme) {
    this.state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.saveState();
  },

  updateSoundToggleIcon() {
    const btn = this.elements.btnSoundToggle;
    if (this.state.soundEnabled) {
      btn.classList.add('active');
      btn.title = 'Sound On';
    } else {
      btn.classList.remove('active');
      btn.title = 'Sound Off';
    }
  },

  updatePersonaBadge() {
    const persona = this.personas[this.state.activePersona] || this.personas.core;
    this.elements.currentPersonaName.textContent = persona.name;
    this.elements.currentPersonaRole.textContent = persona.role;
    this.elements.currentPersonaIcon.textContent = persona.icon;

    const modelName = this.settings.geminiModel === 'gemini-1.5-pro' 
      ? 'Gemini 1.5 Pro' 
      : (this.settings.geminiModel === 'gemini-2.0-flash' ? 'Gemini 2.0 Flash' : 'Gemini 1.5 Flash');

    this.elements.modelNameBadge.textContent = modelName;
  },

  selectPersona(personaId) {
    NexusAudio.playClickSound();
    this.state.activePersona = personaId;
    this.saveState();
    this.updatePersonaBadge();
    this.closeAllModals();
    this.showToast(`Active persona: ${this.personas[personaId].name}`);

    const chat = this.getActiveChat();
    if (chat && chat.messages.length === 0) {
      this.renderChat();
    }
  },

  openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('open');
  },

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  },

  showToast(message, icon = '✦') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    this.elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  },

  renderSidebar(filterQuery = '') {
    const list = this.elements.historyList;
    list.innerHTML = '';

    let chats = [...this.state.chats];
    if (filterQuery) {
      chats = chats.filter(c => c.title.toLowerCase().includes(filterQuery));
    }

    chats.sort((a, b) => {
      if (a.pinned === b.pinned) return b.createdAt - a.createdAt;
      return a.pinned ? -1 : 1;
    });

    if (chats.length === 0) {
      list.innerHTML = `<div style="padding:16px;font-size:0.8rem;color:var(--text-muted);text-align:center;">No conversations found</div>`;
      return;
    }

    const pinnedChats = chats.filter(c => c.pinned);
    const recentChats = chats.filter(c => !c.pinned);

    if (pinnedChats.length > 0) {
      const pinHeader = document.createElement('div');
      pinHeader.className = 'history-section-title';
      pinHeader.textContent = 'Pinned';
      list.appendChild(pinHeader);
      pinnedChats.forEach(chat => list.appendChild(this.createSidebarItem(chat)));
    }

    if (recentChats.length > 0) {
      const recentHeader = document.createElement('div');
      recentHeader.className = 'history-section-title';
      recentHeader.textContent = 'Recent';
      list.appendChild(recentHeader);
      recentChats.forEach(chat => list.appendChild(this.createSidebarItem(chat)));
    }
  },

  createSidebarItem(chat) {
    const item = document.createElement('div');
    item.className = `history-item ${chat.id === this.state.activeChatId ? 'active' : ''}`;
    item.onclick = () => this.selectChat(chat.id);

    item.innerHTML = `
      <div class="history-item-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="history-item-text">${MarkdownParser.escapeHtml(chat.title)}</span>
      </div>
      <div class="history-item-actions">
        <button class="btn-icon-mini" title="${chat.pinned ? 'Unpin' : 'Pin'}" onclick="NexusApp.togglePinChat('${chat.id}', event)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${chat.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="17" x2="12" y2="22"></line>
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
          </svg>
        </button>
        <button class="btn-icon-mini" title="Rename" onclick="NexusApp.renameChat('${chat.id}', event)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
        <button class="btn-icon-mini delete" title="Delete" onclick="NexusApp.deleteChat('${chat.id}', event)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    return item;
  },

  renderChat() {
    const chat = this.getActiveChat();
    const wrapper = this.elements.chatContentWrapper;
    wrapper.innerHTML = '';

    if (!chat || chat.messages.length === 0) {
      this.renderWelcomeHero(wrapper);
      return;
    }

    chat.messages.forEach(msg => {
      this.appendMessageNode(msg, false);
    });

    this.scrollToBottom();
  },

  renderWelcomeHero(container) {
    const persona = this.personas[this.state.activePersona] || this.personas.core;
    const hero = document.createElement('div');
    hero.className = 'welcome-hero';
    hero.innerHTML = `
      <div class="hero-avatar-wrapper">
        <div class="hero-glow-ring"></div>
        <img src="assets/avatar.jpg" alt="Nexus AI" class="hero-avatar" />
      </div>
      <h2 class="welcome-title">Empowering Intelligence</h2>
      <p class="welcome-subtitle">${persona.welcomeGreeting}</p>

      <div class="action-cards-grid">
        <div class="action-card" onclick="NexusApp.usePromptCard('How does Google Gemini compare with traditional LLMs in multi-turn reasoning?')">
          <div class="action-card-icon">🌟</div>
          <div class="action-card-content">
            <h4>Google Gemini</h4>
            <p>Multimodal reasoning, 1M+ token context & speed</p>
          </div>
        </div>

        <div class="action-card" onclick="NexusApp.usePromptCard('How does Supabase integrate with our Node.js backend?')">
          <div class="action-card-icon">🗄️</div>
          <div class="action-card-content">
            <h4>Supabase Integration</h4>
            <p>PostgreSQL schema, message persistence & RLS</p>
          </div>
        </div>

        <div class="action-card" onclick="NexusApp.usePromptCard('Write a resilient asynchronous worker function with exponential backoff in JavaScript')">
          <div class="action-card-icon">💻</div>
          <div class="action-card-content">
            <h4>Code Architecture</h4>
            <p>Production async error handling & backoff</p>
          </div>
        </div>

        <div class="action-card" onclick="NexusApp.usePromptCard('Design a 30-day go-to-market plan for an AI developer tooling product')">
          <div class="action-card-icon">🚀</div>
          <div class="action-card-content">
            <h4>Growth Blueprint</h4>
            <p>High-leverage conversion experiments & KPI roadmap</p>
          </div>
        </div>
      </div>
    `;
    container.appendChild(hero);
  },

  usePromptCard(promptText) {
    NexusAudio.playClickSound();
    this.elements.chatInput.value = promptText;
    this.handleInputResize();
    this.updateTokenCounter();
    this.updateSendButtonState();
    this.sendMessage();
  },

  appendMessageNode(msg, animate = true) {
    const wrapper = this.elements.chatContentWrapper;
    const hero = wrapper.querySelector('.welcome-hero');
    if (hero) hero.remove();

    const isUser = msg.role === 'user';
    const persona = this.personas[this.state.activePersona] || this.personas.core;

    const node = document.createElement('div');
    node.className = `message-wrapper ${isUser ? 'user' : 'bot'}`;
    node.id = `msg-${msg.id}`;

    const parsedContent = MarkdownParser.parse(msg.content);
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isUser) {
      node.innerHTML = `
        <div class="user-avatar-circle">U</div>
        <div class="message-body">
          <div class="message-header-info">
            <span class="message-author-name">You</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>
          <div class="message-bubble markdown-content">${parsedContent}</div>
        </div>
      `;
    } else {
      node.innerHTML = `
        <img src="assets/avatar.jpg" alt="AI Avatar" class="message-avatar" />
        <div class="message-body">
          <div class="message-header-info">
            <span class="message-author-name">${persona.name} (Gemini)</span>
            <span>•</span>
            <span>${timeStr}</span>
          </div>
          <div class="message-bubble markdown-content">${parsedContent}</div>
          <div class="message-actions-bar">
            <button class="action-pill-btn" title="Copy response" onclick="NexusApp.copyMessageText('${msg.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </button>
            <button class="action-pill-btn" title="Read Aloud" onclick="NexusApp.speakMessage('${msg.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              <span>Listen</span>
            </button>
          </div>
        </div>
      `;
    }

    wrapper.appendChild(node);
    if (!this.state.userScrolledUp) {
      this.scrollToBottom();
    }
    return node;
  },

  scrollToBottom() {
    this.elements.chatScrollArea.scrollTop = this.elements.chatScrollArea.scrollHeight;
  },

  async sendMessage() {
    const text = this.elements.chatInput.value.trim();
    if (!text || this.state.isGenerating) return;

    NexusAudio.playSendSound();

    let chat = this.getActiveChat();
    if (!chat) {
      chat = this.createNewChat(false);
    }

    if (chat.messages.length === 0) {
      chat.title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      this.renderSidebar();
    }

    const userMsg = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    chat.messages.push(userMsg);
    this.appendMessageNode(userMsg);

    this.elements.chatInput.value = '';
    this.handleInputResize();
    this.updateTokenCounter();
    this.updateSendButtonState();
    this.saveState();

    const botMsgId = 'msg_' + (Date.now() + 1);
    const botMsg = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    chat.messages.push(botMsg);

    const botNode = this.appendMessageNode(botMsg);
    const bubble = botNode.querySelector('.message-bubble');
    bubble.innerHTML = '<span class="typing-cursor"></span>';

    this.setGeneratingState(true);
    let accumulatedText = '';

    // Stream Google Gemini from backend with Supabase chat metadata
    await NexusClientAPI.streamChat(
      chat.messages.slice(0, -1),
      {
        chatId: chat.id,
        chatTitle: chat.title,
        persona: this.state.activePersona,
        geminiModel: this.settings.geminiModel,
        geminiApiKey: this.settings.geminiApiKey,
        temperature: this.settings.temperature,
        systemPrompt: this.settings.systemPrompt
      },
      (token) => {
        accumulatedText += token;
        botMsg.content = accumulatedText;
        bubble.innerHTML = MarkdownParser.parse(accumulatedText) + '<span class="typing-cursor"></span>';
        if (!this.state.userScrolledUp) {
          this.scrollToBottom();
        }
      },
      (extra) => {
        if (extra) accumulatedText += extra;
        botMsg.content = accumulatedText;
        bubble.innerHTML = MarkdownParser.parse(accumulatedText);
        this.setGeneratingState(false);
        this.saveState();
        NexusAudio.playReceiveSound();
      },
      (err) => {
        bubble.innerHTML = `<span style="color:var(--accent-rose);">⚠️ Gemini Error: ${MarkdownParser.escapeHtml(err.message)}</span>`;
        this.setGeneratingState(false);
        this.saveState();
      }
    );
  },

  setGeneratingState(isGenerating) {
    this.state.isGenerating = isGenerating;
    this.elements.btnSend.style.display = isGenerating ? 'none' : 'flex';
    this.elements.btnStop.style.display = isGenerating ? 'flex' : 'none';
    this.updateSendButtonState();
  },

  copyCode(btn) {
    NexusAudio.playClickSound();
    const container = btn.closest('.code-block-container');
    const raw = container.querySelector('.raw-code').value;
    navigator.clipboard.writeText(raw).then(() => {
      btn.classList.add('copied');
      btn.querySelector('span').textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.querySelector('span').textContent = 'Copy';
      }, 2000);
    });
  },

  copyMessageText(msgId) {
    NexusAudio.playClickSound();
    const chat = this.getActiveChat();
    const msg = chat?.messages.find(m => m.id === msgId);
    if (!msg) return;

    navigator.clipboard.writeText(msg.content).then(() => {
      this.showToast('Copied to clipboard');
    });
  },

  speakMessage(msgId) {
    NexusAudio.playClickSound();
    const chat = this.getActiveChat();
    const msg = chat?.messages.find(m => m.id === msgId);
    if (!msg) return;

    if (NexusAudio.isSpeaking()) {
      NexusAudio.stopSpeech();
      this.showToast('Speech stopped');
    } else {
      NexusAudio.speak(msg.content, () => {
        this.showToast('Speaking Gemini response...');
      }, () => {
        this.showToast('Finished speech');
      });
    }
  },

  exportChat(format) {
    NexusAudio.playClickSound();
    const chat = this.getActiveChat();
    if (!chat || chat.messages.length === 0) {
      this.showToast('Conversation is empty');
      return;
    }

    let filename = (chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'chat') + '.' + format;
    let data = '';
    let mime = 'text/plain';

    if (format === 'json') {
      data = JSON.stringify(chat, null, 2);
      mime = 'application/json';
    } else if (format === 'md') {
      data = `# ${chat.title}\n*Exported from Nexus AI (Google Gemini) on ${new Date().toLocaleString()}*\n\n---\n\n`;
      chat.messages.forEach(m => {
        data += `### ${m.role === 'user' ? '👤 User' : '🌟 Google Gemini'} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n---\n\n`;
      });
      mime = 'text/markdown';
    } else {
      data = `${chat.title}\nExported: ${new Date().toLocaleString()}\n\n`;
      chat.messages.forEach(m => {
        data += `[${m.role.toUpperCase()}] ${m.content}\n\n`;
      });
    }

    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.closeAllModals();
    this.showToast(`Exported as .${format}`);
  },

  clearAllConversations() {
    if (!confirm('Are you sure you want to delete all conversations?')) {
      return;
    }
    this.state.chats = [];
    this.state.activeChatId = null;
    this.saveState();
    this.createNewChat(true);
    this.closeAllModals();
    this.showToast('All conversations cleared');
  },

  populateSettingsForm() {
    document.getElementById('setting-gemini-model').value = this.settings.geminiModel || 'gemini-1.5-flash';
    document.getElementById('setting-gemini-key').value = this.settings.geminiApiKey || '';
    document.getElementById('setting-temp').value = this.settings.temperature || 0.7;
    document.getElementById('setting-temp-val').textContent = this.settings.temperature || 0.7;
    document.getElementById('setting-system-prompt').value = this.settings.systemPrompt || '';

    document.getElementById('setting-supabase-url').value = this.settings.supabaseUrl || '';
    document.getElementById('setting-supabase-key').value = this.settings.supabaseKey || '';
  },

  async testSupabaseConnectionFromUI() {
    const url = document.getElementById('setting-supabase-url').value.trim();
    const key = document.getElementById('setting-supabase-key').value.trim();
    const statusBox = document.getElementById('supabase-test-status');

    statusBox.style.display = 'block';
    statusBox.innerHTML = 'Connecting to Supabase...';
    statusBox.style.color = 'var(--text-secondary)';

    const result = await NexusClientAPI.testDatabaseConnection(url, key);
    if (result.success) {
      statusBox.innerHTML = `✅ ${result.message}`;
      statusBox.style.color = 'var(--accent-emerald)';
      this.state.supabaseConnected = true;
      this.updateDatabaseBadge({ configured: true });
    } else {
      statusBox.innerHTML = `⚠️ ${result.message}`;
      statusBox.style.color = 'var(--accent-rose)';
    }
  },

  saveSettingsForm() {
    NexusAudio.playClickSound();
    this.settings.geminiModel = document.getElementById('setting-gemini-model').value;
    this.settings.geminiApiKey = document.getElementById('setting-gemini-key').value.trim();
    this.settings.temperature = parseFloat(document.getElementById('setting-temp').value);
    this.settings.systemPrompt = document.getElementById('setting-system-prompt').value.trim();
    this.settings.supabaseUrl = document.getElementById('setting-supabase-url').value.trim();
    this.settings.supabaseKey = document.getElementById('setting-supabase-key').value.trim();
    this.saveState();

    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      NexusClientAPI.testDatabaseConnection(this.settings.supabaseUrl, this.settings.supabaseKey);
    }

    this.updatePersonaBadge();
    this.closeAllModals();
    this.showToast('Gemini & Supabase settings saved');
  },

  initCanvasBackground() {
    const canvas = this.elements.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const count = 38;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    let mouse = { x: -1000, y: -1000 };
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1,
        color: i % 2 === 0 ? 'rgba(99, 102, 241,' : 'rgba(6, 182, 212,'
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        let dx = mouse.x - p.x;
        let dy = mouse.y - p.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.x -= (dx / dist) * 0.8;
          p.y -= (dy / dist) * 0.8;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color + ' 0.55)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color + ' 0.8)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          let p2 = particles[j];
          let d = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.12 * (1 - d / 110)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };
    draw();
  }
};

window.addEventListener('DOMContentLoaded', () => {
  NexusApp.init();
});

window.NexusApp = NexusApp;
