import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, MessageSquare, Sun, Moon, Menu, Plus, Edit2, Check, X, Search } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const savedSessions = localStorage.getItem("chatSessions");
    const savedChatId = localStorage.getItem("currentChatId");
    if (savedSessions) setChatSessions(JSON.parse(savedSessions));
    if (savedChatId) {
      setCurrentChatId(savedChatId);
      const chat = JSON.parse(savedSessions || "[]").find(c => c.id === savedChatId);
      if (chat) setMessages(chat.messages);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => {
    if (currentChatId) localStorage.setItem("currentChatId", currentChatId);
  }, [currentChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewChat = () => {
    const newChatId = Date.now().toString();
    const newChat = {
      id: newChatId,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setChatSessions(prev => [newChat, ...prev]);
    setCurrentChatId(newChatId);
    setMessages([]);
  };

  const loadChat = (chatId) => {
    const chat = chatSessions.find(c => c.id === chatId);
    if (chat) {
      setCurrentChatId(chatId);
      setMessages(chat.messages);
    }
  };

  const updateChatTitle = (chatId, newTitle) => {
    setChatSessions(prev => prev.map(chat =>
      chat.id === chatId
        ? { ...chat, title: newTitle, updatedAt: new Date().toISOString() }
        : chat
    ));
  };

  const deleteChat = (chatId) => {
    setChatSessions(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
      localStorage.removeItem("currentChatId");
    }
  };

  const saveCurrentChat = (newMessages) => {
    if (currentChatId) {
      setChatSessions(prev => prev.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: newMessages,
              updatedAt: new Date().toISOString(),
              title: chat.title === "New Chat" && newMessages.length > 0
                ? newMessages[0].text.substring(0, 30) + "..."
                : chat.title
            }
          : chat
      ));
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    if (!currentChatId) {
      createNewChat();
      setTimeout(() => sendMessageToCurrentChat(), 100);
      return;
    }
    sendMessageToCurrentChat();
  };

  const sendMessageToCurrentChat = async () => {
    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userMessage.text }] }]
          })
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I couldn\'t generate a response.';

      const aiMessage = {
        id: Date.now() + 1,
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString()
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      saveCurrentChat(finalMessages);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${error.message}. Please check your API key or internet connection.`,
        sender: 'ai',
        timestamp: new Date().toLocaleTimeString(),
        isError: true
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      saveCurrentChat(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    const elements = [];
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const [fullMatch, lang, code] = match;
      if (match.index > lastIndex) {
        elements.push(
          <p key={lastIndex} className="whitespace-pre-wrap break-words">
            {text.slice(lastIndex, match.index)}
          </p>
        );
      }
      elements.push(
        <SyntaxHighlighter
          key={match.index}
          language={lang || 'javascript'}
          style={isDarkMode ? vscDarkPlus : oneLight}
          customStyle={{ borderRadius: '0.5rem', fontSize: '0.85rem', padding: '1rem', margin: '0.5rem 0' }}
        >
          {code.trim()}
        </SyntaxHighlighter>
      );
      lastIndex = codeBlockRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      elements.push(
        <p key={lastIndex} className="whitespace-pre-wrap break-words">
          {text.slice(lastIndex)}
        </p>
      );
    }
    return elements;
  };

  const startEditingTitle = (chatId, currentTitle) => {
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };
  const saveEditedTitle = () => {
    if (editingTitle.trim()) updateChatTitle(editingChatId, editingTitle.trim());
    setEditingChatId(null);
    setEditingTitle('');
  };
  const cancelEditing = () => {
    setEditingChatId(null);
    setEditingTitle('');
  };

  const filteredChats = chatSessions.filter(chat => {
    const q = searchQuery.toLowerCase();
    return (
      chat.title.toLowerCase().includes(q) ||
      chat.messages.some(m => m.text.toLowerCase().includes(q))
    );
  });

  const themeClasses = {
    bg: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    text: isDarkMode ? 'text-white' : 'text-gray-900',
    sidebar: isDarkMode ? 'bg-gray-800' : 'bg-white',
    header: isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    input: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
    userMsg: 'bg-blue-600 text-white',
    aiMsg: isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900',
    button: isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-200'
  };

  return (
    <div className={`flex h-screen ${themeClasses.bg} ${themeClasses.text}`}>
      {/* Sidebar with responsive behavior */}
      <div
        className={`
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          fixed md:static top-0 left-0 h-full md:h-auto w-64 md:w-80
          ${themeClasses.sidebar} border-r ${themeClasses.border} flex flex-col
          transform md:transform-none transition-transform duration-300 ease-in-out z-50
        `}
      >
        <div className={`p-4 border-b ${themeClasses.border} space-y-3`}>
          <button
            onClick={createNewChat}
            className={`w-full flex items-center justify-center space-x-2 p-3 ${themeClasses.button} border ${themeClasses.border} rounded-lg transition-colors`}
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${themeClasses.input}`}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredChats.map((chat) => (
              <div key={chat.id} className="cursor-pointer" onClick={() => loadChat(chat.id)}>
                <h3 className="text-sm font-medium truncate">{chat.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile overlay when sidebar open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-40"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className={`flex items-center justify-between p-4 border-b ${themeClasses.border} ${themeClasses.header}`}>
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 ${themeClasses.button} rounded-lg transition-colors`}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MiniChatbot</h1>
            </div>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 ${themeClasses.button} rounded-lg transition-colors`}>
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <h2 className="text-2xl font-bold mb-2">Welcome to MiniChatBot</h2>
              <p className="text-center mb-4">Your AI assistant powered by Google AI</p>
              <p className="text-sm">Start a conversation or create a new chat to begin!</p>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-4xl ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.sender === 'user' ? 'bg-blue-600 ml-3' : 'bg-purple-600 mr-3'}`}>
                  {message.sender === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-full ${message.sender === 'user' ? themeClasses.userMsg : message.isError ? 'bg-red-600 text-white' : themeClasses.aiMsg}`}>
                  <div>{formatMessage(message.text)}</div>
                  <div className={`text-xs mt-1 opacity-70 ${message.sender === 'user' ? 'text-blue-100' : (isDarkMode ? 'text-gray-300' : 'text-gray-500')}`}>
                    {message.timestamp}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex max-w-4xl">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-600 mr-3">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className={`${themeClasses.aiMsg} rounded-2xl px-4 py-3`}>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${themeClasses.border} ${themeClasses.header}`}>
          <div className="flex items-end space-x-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                className={`w-full p-3 pr-12 ${themeClasses.input} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32`}
                rows="1"
                style={{ minHeight: '48px', height: 'auto' }}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; }}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className={`p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
