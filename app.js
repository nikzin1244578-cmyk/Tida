// TIDA AI - Complete JavaScript Application
// Configuration
const CONFIG = {
  OPENROUTER_API_KEY: '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', // Replace with your actual API key
  MODEL: 'openai/gpt-oss-120b:free',
  API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};

// State Management
const state = {
  currentUser: null,
  currentChatId: null,
  chats: [],
  messages: []
};

// DOM Elements
const elements = {
  loginModal: document.getElementById('loginModal'),
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('overlay'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  userStatus: document.getElementById('userStatus'),
  logoutBtn: document.getElementById('logoutBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  deleteAllBtn: document.getElementById('deleteAllBtn'),
  chatHistory: document.getElementById('chatHistory'),
  chatCount: document.getElementById('chatCount'),
  chatBox: document.getElementById('chatBox'),
  welcomeMessage: document.getElementById('welcomeMessage'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  clearBtn: document.getElementById('clearBtn'),
  voiceBtn: document.getElementById('voiceBtn')
};

// Initialize Application
function init() {
  loadFromLocalStorage();
  setupEventListeners();
  checkLoginStatus();
}

// Event Listeners
function setupEventListeners() {
  // Mobile menu
  elements.mobileMenuBtn.addEventListener('click', toggleSidebar);
  elements.overlay.addEventListener('click', closeSidebar);
  
  // Chat actions
  elements.newChatBtn.addEventListener('click', createNewChat);
  elements.deleteAllBtn.addEventListener('click', deleteAllChats);
  elements.logoutBtn.addEventListener('click', logout);
  
  // Input actions
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.clearBtn.addEventListener('click', clearInput);
  elements.voiceBtn.addEventListener('click', startVoiceInput);
  
  // Textarea auto-resize and Enter key
  elements.userInput.addEventListener('input', autoResizeTextarea);
  elements.userInput.addEventListener('keydown', handleKeyDown);
}

// Authentication
function checkLoginStatus() {
  const user = localStorage.getItem('tidaUser');
  if (user) {
    state.currentUser = JSON.parse(user);
    showMainInterface();
  } else {
    elements.loginModal.classList.add('show');
  }
}

function handleGoogleSignIn(response) {
  // Parse Google JWT token
  const payload = parseJwt(response.credential);
  
  state.currentUser = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
    provider: 'google'
  };
  
  localStorage.setItem('tidaUser', JSON.stringify(state.currentUser));
  showMainInterface();
}

function devLogin() {
  state.currentUser = {
    id: 'dev_' + Date.now(),
    name: 'Guest User',
    email: 'guest@tida.ai',
    picture: null,
    provider: 'guest'
  };
  
  localStorage.setItem('tidaUser', JSON.stringify(state.currentUser));
  showMainInterface();
}

function logout() {
  if (confirm('Are you sure you want to logout? Your chats will be saved locally.')) {
    localStorage.removeItem('tidaUser');
    state.currentUser = null;
    elements.loginModal.classList.add('show');
    updateUserProfile();
  }
}

function showMainInterface() {
  elements.loginModal.classList.remove('show');
  updateUserProfile();
  
  if (state.chats.length === 0) {
    createNewChat();
  } else {
    loadChat(state.chats[0].id);
  }
  
  renderChatHistory();
}

function updateUserProfile() {
  if (state.currentUser) {
    elements.userName.textContent = state.currentUser.name;
    elements.userEmail.textContent = state.currentUser.email;
    elements.userStatus.classList.add('online');
    elements.logoutBtn.classList.remove('hidden');
    
    if (state.currentUser.picture) {
      elements.userAvatar.innerHTML = `
        <img src="${state.currentUser.picture}" alt="User Avatar">
        <div class="user-status online"></div>
      `;
    }
  } else {
    elements.userName.textContent = 'Guest User';
    elements.userEmail.textContent = 'Sign in to save';
    elements.userStatus.classList.remove('online');
    elements.logoutBtn.classList.add('hidden');
  }
}

// Chat Management
function createNewChat() {
  const chatId = 'chat_' + Date.now();
  const newChat = {
    id: chatId,
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  state.chats.unshift(newChat);
  state.currentChatId = chatId;
  state.messages = [];
  
  saveToLocalStorage();
  renderChatHistory();
  clearChatBox();
  elements.userInput.focus();
}

function loadChat(chatId) {
  const chat = state.chats.find(c => c.id === chatId);
  if (!chat) return;
  
  state.currentChatId = chatId;
  state.messages = chat.messages || [];
  
  renderMessages();
  updateActiveChatItem();
  closeSidebar();
}

function deleteChat(chatId) {
  if (!confirm('Delete this chat?')) return;
  
  state.chats = state.chats.filter(c => c.id !== chatId);
  
  if (state.currentChatId === chatId) {
    if (state.chats.length > 0) {
      loadChat(state.chats[0].id);
    } else {
      createNewChat();
    }
  }
  
  saveToLocalStorage();
  renderChatHistory();
}

function deleteAllChats() {
  if (!confirm('Delete all chats? This cannot be undone.')) return;
  
  state.chats = [];
  state.messages = [];
  state.currentChatId = null;
  
  saveToLocalStorage();
  renderChatHistory();
  createNewChat();
}

function updateChatTitle(chatId, firstMessage) {
  const chat = state.chats.find(c => c.id === chatId);
  if (chat && chat.messages.length === 1) {
    chat.title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
    chat.updatedAt = Date.now();
    saveToLocalStorage();
    renderChatHistory();
  }
}

// Message Handling
async function sendMessage() {
  const message = elements.userInput.value.trim();
  if (!message) return;
  
  // Add user message
  addMessage('user', message);
  elements.userInput.value = '';
  autoResizeTextarea();
  
  // Show typing indicator
  showTypingIndicator();
  
  try {
    // Make API call with reasoning
    const response = await callOpenRouterAPI(state.messages);
    
    // Hide typing indicator
    hideTypingIndicator();
    
    // Add assistant response
    if (response) {
      addMessage('assistant', response.content, response.reasoning_details);
    } else {
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    }
  } catch (error) {
    hideTypingIndicator();
    console.error('API Error:', error);
    addMessage('assistant', 'Sorry, I encountered an error connecting to the AI service. Please check your API key and try again.');
  }
}

function addMessage(role, content, reasoningDetails = null) {
  const message = {
    role,
    content,
    timestamp: Date.now()
  };
  
  if (reasoningDetails) {
    message.reasoning_details = reasoningDetails;
  }
  
  state.messages.push(message);
  
  // Update current chat
  const chat = state.chats.find(c => c.id === state.currentChatId);
  if (chat) {
    chat.messages = state.messages;
    chat.updatedAt = Date.now();
    
    // Update title with first user message
    if (role === 'user' && chat.messages.length === 1) {
      updateChatTitle(chat.id, content);
    }
  }
  
  saveToLocalStorage();
  renderMessage(message);
  scrollToBottom();
}

// API Integration
async function callOpenRouterAPI(messages) {
  // Prepare messages for API (exclude reasoning_details from user messages)
  const apiMessages = messages.map(msg => {
    const apiMsg = {
      role: msg.role,
      content: msg.content
    };
    
    // Preserve reasoning_details for assistant messages
    if (msg.role === 'assistant' && msg.reasoning_details) {
      apiMsg.reasoning_details = msg.reasoning_details;
    }
    
    return apiMsg;
  });
  
  const requestBody = {
    model: CONFIG.MODEL,
    messages: apiMessages,
    reasoning: { enabled: true }
  };
  
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices[0].message;
}

// UI Rendering
function renderMessages() {
  clearChatBox();
  state.messages.forEach(msg => renderMessage(msg));
  scrollToBottom();
}

function renderMessage(message) {
  elements.welcomeMessage.classList.add('hidden');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${message.role}`;
  
  const avatarIcon = message.role === 'user' 
    ? '<i class="fas fa-user"></i>' 
    : '<i class="fas fa-robot"></i>';
  
  const label = message.role === 'user' ? 'You' : 'TIDA AI';
  
  // Format message content
  const formattedContent = formatMessageContent(message.content);
  
  messageDiv.innerHTML = `
    <div class="message-content-wrapper">
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-bubble">
        <div class="message-label">${label}</div>
        <div class="message-text">${formattedContent}</div>
      </div>
    </div>
  `;
  
  elements.chatBox.appendChild(messageDiv);
  
  // Add copy buttons to code blocks
  messageDiv.querySelectorAll('pre').forEach(pre => {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyBtn.onclick = () => copyCode(pre, copyBtn);
    pre.appendChild(copyBtn);
  });
}

function formatMessageContent(content) {
  // Escape HTML
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Format code blocks
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`;
  });
  
  // Format inline code
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Format line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

function renderChatHistory() {
  elements.chatHistory.innerHTML = '';
  elements.chatCount.textContent = state.chats.length;
  
  state.chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    if (chat.id === state.currentChatId) {
      chatItem.classList.add('active');
    }
    
    const date = new Date(chat.updatedAt);
    const timeStr = formatTime(date);
    
    chatItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${chat.title}
          </div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
            ${timeStr}
          </div>
        </div>
        <button onclick="deleteChat('${chat.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; opacity: 0.7; transition: opacity 0.2s;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    chatItem.onclick = (e) => {
      if (!e.target.closest('button')) {
        loadChat(chat.id);
      }
    };
    
    elements.chatHistory.appendChild(chatItem);
  });
}

function updateActiveChatItem() {
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeItem = Array.from(document.querySelectorAll('.chat-item'))
    .find(item => item.onclick.toString().includes(state.currentChatId));
  
  if (activeItem) {
    activeItem.classList.add('active');
  }
}

// Utility Functions
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message assistant';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
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
  elements.chatBox.appendChild(typingDiv);
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function clearChatBox() {
  elements.chatBox.innerHTML = '';
  elements.welcomeMessage.classList.remove('hidden');
  elements.chatBox.appendChild(elements.welcomeMessage);
}

function clearInput() {
  elements.userInput.value = '';
  autoResizeTextarea();
  elements.userInput.focus();
}

function autoResizeTextarea() {
  const textarea = elements.userInput;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function scrollToBottom() {
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
}

function toggleSidebar() {
  elements.sidebar.classList.toggle('open');
  elements.overlay.classList.toggle('show');
}

function closeSidebar() {
  elements.sidebar.classList.remove('open');
  elements.overlay.classList.remove('show');
}

function copyCode(pre, btn) {
  const code = pre.querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
  });
}

function startVoiceInput() {
  if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'km-KH'; // Khmer language
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      elements.voiceBtn.style.color = '#ef4444';
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      elements.userInput.value = transcript;
      autoResizeTextarea();
    };
    
    recognition.onend = () => {
      elements.voiceBtn.style.color = '';
    };
    
    recognition.start();
  } else {
    alert('Voice input is not supported in your browser.');
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// Local Storage
function saveToLocalStorage() {
  try {
    localStorage.setItem('tidaChats', JSON.stringify(state.chats));
    localStorage.setItem('tidaCurrentChatId', state.currentChatId);
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

function loadFromLocalStorage() {
  try {
    const chats = localStorage.getItem('tidaChats');
    const currentChatId = localStorage.getItem('tidaCurrentChatId');
    
    if (chats) state.chats = JSON.parse(chats);
    if (currentChatId) state.currentChatId = currentChatId;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
}

// Global functions for HTML onclick handlers
window.handleGoogleSignIn = handleGoogleSignIn;
window.devLogin = devLogin;
window.deleteChat = deleteChat;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}