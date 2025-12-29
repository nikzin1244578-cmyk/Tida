// TIDA AI - Khmer AI Assistant Application
// Configuration
const CONFIG = {
  API_URL: "https://openrouter.ai/api/v1/chat/completions",
  API_KEY: "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", // Replace with your actual API key
  MODEL: "nex-agi/deepseek-v3.1-nex-n1:free",
  SITE_URL: "https://tida-ai.app",
  SITE_NAME: "TIDA AI"
};

// State Management
let currentUser = null;
let currentChatId = null;
let chats = [];
let messages = [];

// DOM Elements
const elements = {
  loginModal: document.getElementById('loginModal'),
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('overlay'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  chatBox: document.getElementById('chatBox'),
  welcomeMessage: document.getElementById('welcomeMessage'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  clearBtn: document.getElementById('clearBtn'),
  voiceBtn: document.getElementById('voiceBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  deleteAllBtn: document.getElementById('deleteAllBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  chatHistory: document.getElementById('chatHistory'),
  chatCount: document.getElementById('chatCount'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  userAvatar: document.getElementById('userAvatar'),
  userStatus: document.getElementById('userStatus')
};

// Initialize Application
function init() {
  loadUserData();
  loadChatsFromStorage();
  setupEventListeners();
  autoResizeTextarea();
  
  if (!currentUser) {
    showLoginModal();
  } else {
    hideLoginModal();
  }
}

// Event Listeners
function setupEventListeners() {
  elements.sendBtn.addEventListener('click', sendMessage);
  elements.userInput.addEventListener('keydown', handleEnterKey);
  elements.userInput.addEventListener('input', autoResizeTextarea);
  elements.clearBtn.addEventListener('click', clearInput);
  elements.voiceBtn.addEventListener('click', toggleVoiceInput);
  elements.newChatBtn.addEventListener('click', createNewChat);
  elements.deleteAllBtn.addEventListener('click', deleteAllChats);
  elements.logoutBtn.addEventListener('click', logout);
  elements.mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
  elements.overlay.addEventListener('click', closeMobileSidebar);
}

// User Authentication
function handleGoogleSignIn(response) {
  try {
    const userData = parseJwt(response.credential);
    currentUser = {
      id: userData.sub,
      name: userData.name,
      email: userData.email,
      picture: userData.picture
    };
    saveUserData();
    updateUserUI();
    hideLoginModal();
    createNewChat();
  } catch (error) {
    console.error('Google sign-in error:', error);
    alert('Failed to sign in. Please try again.');
  }
}

function devLogin() {
  currentUser = {
    id: 'dev_' + Date.now(),
    name: 'Guest User',
    email: 'guest@tida-ai.local',
    picture: null
  };
  saveUserData();
  updateUserUI();
  hideLoginModal();
  createNewChat();
}

function logout() {
  if (confirm('Are you sure you want to logout? Your chats will be deleted.')) {
    currentUser = null;
    chats = [];
    messages = [];
    currentChatId = null;
    localStorage.removeItem('tidaUser');
    localStorage.removeItem('tidaChats');
    location.reload();
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// UI Updates
function updateUserUI() {
  if (currentUser) {
    elements.userName.textContent = currentUser.name;
    elements.userEmail.textContent = currentUser.email;
    elements.userStatus.classList.add('online');
    elements.logoutBtn.classList.remove('hidden');
    
    if (currentUser.picture) {
      elements.userAvatar.innerHTML = `<img src="${currentUser.picture}" alt="${currentUser.name}">`;
    }
  }
}

function showLoginModal() {
  elements.loginModal.classList.add('show');
}

function hideLoginModal() {
  elements.loginModal.classList.remove('show');
}

// Mobile Menu
function toggleMobileSidebar() {
  elements.sidebar.classList.toggle('open');
  elements.overlay.classList.toggle('show');
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove('open');
  elements.overlay.classList.remove('show');
}

// Chat Management
function createNewChat() {
  const chatId = 'chat_' + Date.now();
  const newChat = {
    id: chatId,
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  chats.unshift(newChat);
  currentChatId = chatId;
  messages = [];
  
  saveChatsToStorage();
  renderChatHistory();
  clearChatBox();
  elements.welcomeMessage.classList.remove('hidden');
}

function loadChat(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  
  currentChatId = chatId;
  messages = chat.messages || [];
  
  clearChatBox();
  elements.welcomeMessage.classList.add('hidden');
  
  messages.forEach(msg => {
    appendMessage(msg.role, msg.content, false);
  });
  
  renderChatHistory();
  closeMobileSidebar();
}

function deleteChat(chatId) {
  if (confirm('Delete this chat?')) {
    chats = chats.filter(c => c.id !== chatId);
    
    if (currentChatId === chatId) {
      if (chats.length > 0) {
        loadChat(chats[0].id);
      } else {
        createNewChat();
      }
    }
    
    saveChatsToStorage();
    renderChatHistory();
  }
}

function deleteAllChats() {
  if (confirm('Delete all chats? This cannot be undone.')) {
    chats = [];
    messages = [];
    currentChatId = null;
    saveChatsToStorage();
    renderChatHistory();
    createNewChat();
  }
}

function updateChatTitle(chatId, newTitle) {
  const chat = chats.find(c => c.id === chatId);
  if (chat) {
    chat.title = newTitle.substring(0, 50);
    chat.updatedAt = new Date().toISOString();
    saveChatsToStorage();
    renderChatHistory();
  }
}

// Message Handling
async function sendMessage() {
  const input = elements.userInput.value.trim();
  if (!input) return;
  
  // Hide welcome message
  elements.welcomeMessage.classList.add('hidden');
  
  // Add user message
  appendMessage('user', input);
  messages.push({ role: 'user', content: input });
  
  // Clear input
  elements.userInput.value = '';
  autoResizeTextarea();
  
  // Update chat title if first message
  if (messages.length === 1) {
    updateChatTitle(currentChatId, input);
  }
  
  // Show typing indicator
  const typingId = showTypingIndicator();
  
  // Disable send button
  elements.sendBtn.disabled = true;
  elements.userInput.disabled = true;
  
  try {
    const response = await callOpenRouterAPI(input);
    removeTypingIndicator(typingId);
    
    appendMessage('assistant', response);
    messages.push({ role: 'assistant', content: response });
    
    // Save chat
    updateCurrentChat();
  } catch (error) {
    removeTypingIndicator(typingId);
    appendMessage('assistant', 'Sorry, I encountered an error. Please check your API key and try again.');
    console.error('API Error:', error);
  } finally {
    elements.sendBtn.disabled = false;
    elements.userInput.disabled = false;
    elements.userInput.focus();
  }
}

async function callOpenRouterAPI(userMessage) {
  const response = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CONFIG.API_KEY}`,
      "HTTP-Referer": CONFIG.SITE_URL,
      "X-Title": CONFIG.SITE_NAME,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CONFIG.MODEL,
      messages: [
        {
          role: "system",
          content: "You are TIDA AI, a helpful AI assistant that speaks both Khmer and English fluently. You help users with various tasks including coding, learning, translation, and general questions. Be friendly, concise, and helpful."
        },
        ...messages.slice(-10), // Keep last 10 messages for context
        {
          role: "user",
          content: userMessage
        }
      ]
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// UI Message Functions
function appendMessage(role, content, save = true) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  const avatarIcon = role === 'user' 
    ? '<i class="fas fa-user"></i>' 
    : '<i class="fas fa-robot"></i>';
  
  const label = role === 'user' ? 'You' : 'TIDA AI';
  
  messageDiv.innerHTML = `
    <div class="message-content-wrapper">
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-bubble">
        <div class="message-label">${label}</div>
        <div class="message-text">${formatMessage(content)}</div>
      </div>
    </div>
  `;
  
  elements.chatBox.appendChild(messageDiv);
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
  
  // Add copy buttons to code blocks
  addCopyButtons();
}

function formatMessage(text) {
  // Convert markdown-style code blocks
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code><button class="copy-btn" onclick="copyCode(this)"><i class="fas fa-copy"></i> Copy</button></pre>`;
  });
  
  // Convert inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addCopyButtons() {
  const codeBlocks = elements.chatBox.querySelectorAll('pre code');
  codeBlocks.forEach(block => {
    if (!block.parentElement.querySelector('.copy-btn')) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
      copyBtn.onclick = function() { copyCode(this); };
      block.parentElement.appendChild(copyBtn);
    }
  });
}

function copyCode(button) {
  const pre = button.parentElement;
  const code = pre.querySelector('code');
  const text = code.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      button.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
  });
}

function showTypingIndicator() {
  const typingId = 'typing_' + Date.now();
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.id = typingId;
  messageDiv.innerHTML = `
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
  elements.chatBox.appendChild(messageDiv);
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
  return typingId;
}

function removeTypingIndicator(typingId) {
  const typingElement = document.getElementById(typingId);
  if (typingElement) {
    typingElement.remove();
  }
}

function clearChatBox() {
  elements.chatBox.innerHTML = `
    <div class="welcome" id="welcomeMessage">
      <div class="welcome-card">
        <div class="welcome-icon">
          <i class="fas fa-robot"></i>
        </div>
        <h3 style="font-size: 24px; font-weight: bold; margin-bottom: 12px;">Welcome to TIDA AI</h3>
        <p style="color: #d1d5db; margin-bottom: 24px;">Your Khmer-speaking AI assistant</p>
        <div class="feature-grid">
          <div class="feature-card">
            <i class="fas fa-code" style="color: #60a5fa; font-size: 24px; margin-bottom: 8px;"></i>
            <p style="font-size: 14px;">Code Help</p>
          </div>
          <div class="feature-card">
            <i class="fas fa-graduation-cap" style="color: #10b981; font-size: 24px; margin-bottom: 8px;"></i>
            <p style="font-size: 14px;">Learning</p>
          </div>
          <div class="feature-card">
            <i class="fas fa-language" style="color: #c084fc; font-size: 24px; margin-bottom: 8px;"></i>
            <p style="font-size: 14px;">Khmer</p>
          </div>
        </div>
      </div>
    </div>
  `;
  elements.welcomeMessage = document.getElementById('welcomeMessage');
}

// Input Handling
function handleEnterKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
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

function toggleVoiceInput() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'km-KH'; // Khmer language
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
    
    recognition.onerror = () => {
      alert('Voice input not available');
    };
    
    recognition.start();
  } else {
    alert('Voice input is not supported in your browser');
  }
}

// Chat History UI
function renderChatHistory() {
  elements.chatHistory.innerHTML = '';
  elements.chatCount.textContent = chats.length;
  
  chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
    chatItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${chat.title}</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${formatDate(chat.updatedAt)}</div>
        </div>
        <button onclick="deleteChat('${chat.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 8px; margin-left: 8px;" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    chatItem.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        loadChat(chat.id);
      }
    });
    
    elements.chatHistory.appendChild(chatItem);
  });
}

// Storage Functions
function saveUserData() {
  localStorage.setItem('tidaUser', JSON.stringify(currentUser));
}

function loadUserData() {
  const userData = localStorage.getItem('tidaUser');
  if (userData) {
    currentUser = JSON.parse(userData);
    updateUserUI();
  }
}

function saveChatsToStorage() {
  localStorage.setItem('tidaChats', JSON.stringify(chats));
}

function loadChatsFromStorage() {
  const chatsData = localStorage.getItem('tidaChats');
  if (chatsData) {
    chats = JSON.parse(chatsData);
    if (chats.length > 0) {
      renderChatHistory();
      loadChat(chats[0].id);
    }
  }
}

function updateCurrentChat() {
  const chat = chats.find(c => c.id === currentChatId);
  if (chat) {
    chat.messages = messages;
    chat.updatedAt = new Date().toISOString();
    saveChatsToStorage();
    renderChatHistory();
  }
}

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

// Global Functions (for inline onclick handlers)
window.handleGoogleSignIn = handleGoogleSignIn;
window.devLogin = devLogin;
window.deleteChat = deleteChat;
window.copyCode = copyCode;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}