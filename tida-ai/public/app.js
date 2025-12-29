// TIDA AI - Khmer AI Assistant
// Configuration
const CONFIG = {
  API_URL: 'https://openrouter.ai/api/v1/chat/completions',
  API_KEY: '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', // IMPORTANT: Add your OpenRouter API key here
  MODEL: 'nex-agi/deepseek-v3.1-nex-n1:free',
  SITE_URL: window.location.origin || 'https://tida-ai.com',
  SITE_NAME: 'TIDA AI',
  MAX_HISTORY: 50
};

// Check API key on load
function checkAPIKey() {
  if (!CONFIG.API_KEY || CONFIG.API_KEY === '') {
    console.error('⚠️ API KEY NOT SET!');
    console.log('📝 Please add your OpenRouter API key in app.js line 5');
    console.log('🔗 Get your free API key at: https://openrouter.ai/keys');
    return false;
  }
  return true;
}

// State Management
let currentUser = null;
let currentChatId = null;
let chatHistory = {};
let allChats = [];

// DOM Elements
const elements = {
  loginModal: document.getElementById('loginModal'),
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('overlay'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  chatBox: document.getElementById('chatBox'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  deleteAllBtn: document.getElementById('deleteAllBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  clearBtn: document.getElementById('clearBtn'),
  voiceBtn: document.getElementById('voiceBtn'),
  chatHistoryEl: document.getElementById('chatHistory'),
  welcomeMessage: document.getElementById('welcomeMessage'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  userAvatar: document.getElementById('userAvatar'),
  userStatus: document.getElementById('userStatus'),
  chatCount: document.getElementById('chatCount')
};

// Initialize App
function initApp() {
  loadUserData();
  loadChats();
  updateChatList();
  setupEventListeners();
  
  // Show login modal if not logged in
  if (!currentUser) {
    elements.loginModal.classList.add('show');
  }
  
  // Auto-resize textarea
  autoResizeTextarea();
}

// Event Listeners
function setupEventListeners() {
  // Send message
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // New chat
  elements.newChatBtn.addEventListener('click', createNewChat);
  
  // Delete all chats
  elements.deleteAllBtn.addEventListener('click', deleteAllChats);
  
  // Logout
  elements.logoutBtn.addEventListener('click', logout);
  
  // Clear input
  elements.clearBtn.addEventListener('click', () => {
    elements.userInput.value = '';
    elements.userInput.focus();
  });
  
  // Voice input (placeholder)
  elements.voiceBtn.addEventListener('click', () => {
    alert('Voice input coming soon!');
  });
  
  // Mobile menu
  elements.mobileMenuBtn.addEventListener('click', toggleSidebar);
  elements.overlay.addEventListener('click', closeSidebar);
  
  // Auto-resize textarea
  elements.userInput.addEventListener('input', autoResizeTextarea);
}

// User Authentication
function devLogin() {
  const user = {
    id: 'dev_' + Date.now(),
    name: 'Dev User',
    email: 'dev@tida-ai.com',
    avatar: null
  };
  
  setUser(user);
  elements.loginModal.classList.remove('show');
}

function handleGoogleSignIn(response) {
  // This would be called by Google Sign-In
  const decoded = parseJwt(response.credential);
  
  const user = {
    id: decoded.sub,
    name: decoded.name,
    email: decoded.email,
    avatar: decoded.picture
  };
  
  setUser(user);
  elements.loginModal.classList.remove('show');
}

function setUser(user) {
  currentUser = user;
  localStorage.setItem('tidaai_user', JSON.stringify(user));
  
  // Update UI
  elements.userName.textContent = user.name;
  elements.userEmail.textContent = user.email;
  elements.userStatus.classList.add('online');
  
  if (user.avatar) {
    elements.userAvatar.innerHTML = `<img src="${user.avatar}" alt="${user.name}">`;
  } else {
    elements.userAvatar.innerHTML = `<i class="fas fa-user" style="font-size: 20px;"></i>`;
  }
  
  elements.logoutBtn.classList.remove('hidden');
  
  loadChats();
  updateChatList();
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    currentUser = null;
    currentChatId = null;
    chatHistory = {};
    allChats = [];
    
    localStorage.removeItem('tidaai_user');
    localStorage.removeItem('tidaai_chats');
    localStorage.removeItem('tidaai_current_chat');
    
    elements.userName.textContent = 'Guest User';
    elements.userEmail.textContent = 'Sign in to save';
    elements.userStatus.classList.remove('online');
    elements.userAvatar.innerHTML = `<i class="fas fa-user" style="font-size: 20px;"></i>`;
    elements.logoutBtn.classList.add('hidden');
    
    updateChatList();
    clearChat();
    elements.loginModal.classList.add('show');
  }
}

function loadUserData() {
  const savedUser = localStorage.getItem('tidaai_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    setUser(currentUser);
  }
}

// Chat Management
function createNewChat() {
  const chatId = 'chat_' + Date.now();
  const chat = {
    id: chatId,
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    userId: currentUser?.id || 'guest'
  };
  
  allChats.unshift(chat);
  saveChatData();
  loadChat(chatId);
  updateChatList();
  closeSidebar();
}

function loadChat(chatId) {
  currentChatId = chatId;
  localStorage.setItem('tidaai_current_chat', chatId);
  
  const chat = allChats.find(c => c.id === chatId);
  if (chat) {
    chatHistory = { [chatId]: chat.messages };
    renderMessages();
  }
  
  updateChatList();
}

function deleteChat(chatId) {
  if (confirm('Delete this chat?')) {
    allChats = allChats.filter(c => c.id !== chatId);
    
    if (currentChatId === chatId) {
      currentChatId = null;
      chatHistory = {};
      clearChat();
    }
    
    saveChatData();
    updateChatList();
  }
}

function deleteAllChats() {
  if (confirm('Delete all chats? This cannot be undone!')) {
    allChats = [];
    currentChatId = null;
    chatHistory = {};
    
    saveChatData();
    updateChatList();
    clearChat();
  }
}

function saveChatData() {
  if (currentUser) {
    localStorage.setItem('tidaai_chats', JSON.stringify(allChats));
  }
}

function loadChats() {
  if (currentUser) {
    const saved = localStorage.getItem('tidaai_chats');
    if (saved) {
      allChats = JSON.parse(saved).filter(c => c.userId === currentUser.id);
    }
    
    const savedChatId = localStorage.getItem('tidaai_current_chat');
    if (savedChatId && allChats.find(c => c.id === savedChatId)) {
      loadChat(savedChatId);
    }
  }
}

function updateChatList() {
  elements.chatCount.textContent = allChats.length;
  
  if (allChats.length === 0) {
    elements.chatHistoryEl.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px; font-size: 14px;">No chats yet</div>';
    return;
  }
  
  elements.chatHistoryEl.innerHTML = allChats.map(chat => {
    const isActive = chat.id === currentChatId;
    const preview = chat.messages[0]?.content.substring(0, 50) || 'New Chat';
    
    return `
      <div class="chat-item ${isActive ? 'active' : ''}" onclick="loadChat('${chat.id}')">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
          <div style="font-weight: 500; font-size: 14px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${chat.title}
          </div>
          <button onclick="event.stopPropagation(); deleteChat('${chat.id}')" style="background: none; border: none; color: #6b7280; cursor: pointer; padding: 4px;">
            <i class="fas fa-trash" style="font-size: 12px;"></i>
          </button>
        </div>
        <div style="font-size: 12px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${preview}
        </div>
      </div>
    `;
  }).join('');
}

// Message Handling
async function sendMessage() {
  const message = elements.userInput.value.trim();
  if (!message) return;
  
  // Check API key first
  if (!checkAPIKey()) {
    alert('⚠️ API Key Not Configured!\n\nPlease add your OpenRouter API key in app.js (line 5).\n\nGet your free API key at:\nhttps://openrouter.ai/keys');
    return;
  }
  
  // Create new chat if needed
  if (!currentChatId) {
    createNewChat();
  }
  
  // Hide welcome message
  elements.welcomeMessage.classList.add('hidden');
  
  // Add user message
  addMessage('user', message);
  elements.userInput.value = '';
  autoResizeTextarea();
  
  // Show typing indicator
  const typingId = showTypingIndicator();
  
  try {
    // Get AI response
    const response = await getAIResponse(message);
    removeTypingIndicator(typingId);
    addMessage('assistant', response);
    
    // Update chat title if it's the first message
    const chat = allChats.find(c => c.id === currentChatId);
    if (chat && chat.messages.length === 2) {
      chat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
      updateChatList();
    }
    
  } catch (error) {
    removeTypingIndicator(typingId);
    console.error('Error details:', error);
    
    let errorMessage = 'Sorry, I encountered an error. ';
    
    if (error.message.includes('401')) {
      errorMessage += '🔑 Invalid API Key. Please check your OpenRouter API key in app.js.\n\nGet your key at: https://openrouter.ai/keys';
    } else if (error.message.includes('429')) {
      errorMessage += '⏱️ Rate limit exceeded. Please wait a moment and try again.';
    } else if (error.message.includes('500')) {
      errorMessage += '🔧 Server error. The AI service is temporarily unavailable.';
    } else {
      errorMessage += error.message;
    }
    
    addMessage('assistant', errorMessage);
  }
  
  saveChatData();
}

function addMessage(role, content) {
  if (!chatHistory[currentChatId]) {
    chatHistory[currentChatId] = [];
  }
  
  const message = { role, content, timestamp: new Date().toISOString() };
  chatHistory[currentChatId].push(message);
  
  // Update in allChats
  const chat = allChats.find(c => c.id === currentChatId);
  if (chat) {
    chat.messages.push(message);
  }
  
  renderMessage(message);
  scrollToBottom();
}

function renderMessages() {
  elements.chatBox.innerHTML = '';
  elements.welcomeMessage.classList.add('hidden');
  
  const messages = chatHistory[currentChatId] || [];
  messages.forEach(msg => renderMessage(msg));
  scrollToBottom();
}

function renderMessage(message) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.role}`;
  
  const avatarIcon = message.role === 'user' 
    ? '<i class="fas fa-user"></i>' 
    : '<i class="fas fa-robot"></i>';
  
  const label = message.role === 'user' ? 'You' : 'TIDA AI';
  
  const formattedContent = formatMessageContent(message.content);
  
  messageEl.innerHTML = `
    <div class="message-content-wrapper">
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-bubble">
        <div class="message-label">${label}</div>
        <div class="message-text">${formattedContent}</div>
      </div>
    </div>
  `;
  
  elements.chatBox.appendChild(messageEl);
}

function formatMessageContent(content) {
  // Format code blocks
  content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code><button class="copy-btn" onclick="copyCode(this)"><i class="fas fa-copy"></i> Copy</button></pre>`;
  });
  
  // Format inline code
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Format bold
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Format italic
  content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Format line breaks
  content = content.replace(/\n/g, '<br>');
  
  return content;
}

function showTypingIndicator() {
  const typingId = 'typing_' + Date.now();
  const messageEl = document.createElement('div');
  messageEl.className = 'message assistant';
  messageEl.id = typingId;
  
  messageEl.innerHTML = `
    <div class="message-content-wrapper">
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-bubble">
        <div class="message-label">TIDA AI</div>
        <div class="message-text">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  elements.chatBox.appendChild(messageEl);
  scrollToBottom();
  return typingId;
}

function removeTypingIndicator(typingId) {
  const el = document.getElementById(typingId);
  if (el) el.remove();
}

// AI API Integration
async function getAIResponse(userMessage) {
  const messages = [
    {
      role: 'system',
      content: 'You are TIDA AI, a helpful AI assistant that can communicate in both English and Khmer (ភាសាខ្មែរ). You are knowledgeable, friendly, and provide clear, accurate responses. When users write in Khmer, respond in Khmer. When they write in English, respond in English.'
    }
  ];
  
  // Add conversation history (last 10 messages for context)
  const history = chatHistory[currentChatId] || [];
  const recentHistory = history.slice(-10);
  
  recentHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    });
  });
  
  // Add current message
  messages.push({
    role: 'user',
    content: userMessage
  });
  
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      'HTTP-Referer': CONFIG.SITE_URL,
      'X-Title': CONFIG.SITE_NAME,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid API response format');
  }
  
  return data.choices[0].message.content;
}

// UI Utilities
function clearChat() {
  elements.chatBox.innerHTML = '';
  elements.welcomeMessage.classList.remove('hidden');
  currentChatId = null;
  chatHistory = {};
  localStorage.removeItem('tidaai_current_chat');
}

function toggleSidebar() {
  elements.sidebar.classList.toggle('open');
  elements.overlay.classList.toggle('show');
}

function closeSidebar() {
  elements.sidebar.classList.remove('open');
  elements.overlay.classList.remove('show');
}

function scrollToBottom() {
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
}

function autoResizeTextarea() {
  const textarea = elements.userInput;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function copyCode(button) {
  const pre = button.parentElement;
  const code = pre.querySelector('code').textContent;
  
  navigator.clipboard.writeText(code).then(() => {
    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Make functions globally available
window.devLogin = devLogin;
window.handleGoogleSignIn = handleGoogleSignIn;
window.loadChat = loadChat;
window.deleteChat = deleteChat;
window.copyCode = copyCode;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}