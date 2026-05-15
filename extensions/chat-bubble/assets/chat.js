/**
 * Shop AI Chat - Client-side implementation
 *
 * This module handles the chat interface for the Shopify AI Chat application.
 * It manages the UI interactions, API communication, and message rendering.
 */
(function() {
  'use strict';

  /**
   * Application namespace to prevent global scope pollution
   */
  const ShopAIChat = {
    resolvedApiBaseUrl: null,

    getApiBaseUrl: function() {
      const configuredBaseUrl = window.shopChatConfig?.apiBaseUrl?.trim();

      // Prefer explicit configuration for storefront usage. Fallback keeps local demos working.
      if (configuredBaseUrl) {
        if (configuredBaseUrl.startsWith('http://') || configuredBaseUrl.startsWith('https://')) {
          return configuredBaseUrl.replace(/\/$/, '');
        }

        if (configuredBaseUrl.startsWith('/')) {
          return `${window.location.origin}${configuredBaseUrl}`.replace(/\/$/, '');
        }
      }

      return 'https://localhost:3458';
    },

    getApiBaseCandidates: function() {
      const configuredBaseUrl = this.getApiBaseUrl();
      const candidates = [];

      if (configuredBaseUrl) {
        candidates.push(configuredBaseUrl);
      }

      // Shopify app proxy fallback on the storefront origin.
      candidates.push(`${window.location.origin}/apps/shop-chat-agent`);
      candidates.push('https://localhost:3458');

      return [...new Set(candidates.map((url) => url.replace(/\/$/, '')))];
    },

    buildApiUrl: function(path, baseUrl) {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const effectiveBaseUrl = baseUrl || this.getApiBaseUrl();
      return `${effectiveBaseUrl}${normalizedPath}`;
    },

    fetchFromApi: async function(path, options) {
      const baseCandidates = this.resolvedApiBaseUrl
        ? [this.resolvedApiBaseUrl, ...this.getApiBaseCandidates()]
        : this.getApiBaseCandidates();
      const candidates = [...new Set(baseCandidates)];

      let lastError = null;

      for (const baseUrl of candidates) {
        const url = this.buildApiUrl(path, baseUrl);

        try {
          const response = await fetch(url, options);

          if (response.ok) {
            this.resolvedApiBaseUrl = baseUrl;
            return { response, url };
          }

          lastError = new Error(`Request failed with status ${response.status} for ${url}`);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Failed to reach chat API');
    },

    /**
     * UI-related elements and functionality
     */
    UI: {
      elements: {},
      isMobile: false,

      /**
       * Initialize UI elements and event listeners
       * @param {HTMLElement} container - The main container element
       */
      init: function(container) {
        if (!container) return;

        // Cache DOM elements
        this.elements = {
          container: container,
          chatBubble: container.querySelector('.shop-ai-chat-bubble'),
          chatWindow: container.querySelector('.shop-ai-chat-window'),
          closeButton: container.querySelector('.shop-ai-chat-close'),
          chatInput: container.querySelector('.shop-ai-chat-input input'),
          voiceStatus: container.querySelector('.shop-ai-voice-status'),
          voiceButton: container.querySelector('.shop-ai-chat-voice'),
          sendButton: container.querySelector('.shop-ai-chat-send'),
          messagesContainer: container.querySelector('.shop-ai-chat-messages')
        };

        // Detect mobile device
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Set up event listeners
        this.setupEventListeners();

        // Fix for iOS Safari viewport height issues
        if (this.isMobile) {
          this.setupMobileViewport();
        }
      },

      /**
       * Set up all event listeners for UI interactions
       */
      setupEventListeners: function() {
        const { chatBubble, closeButton, chatInput, voiceButton, sendButton, messagesContainer } = this.elements;

        // Toggle chat window visibility
        chatBubble.addEventListener('click', () => this.toggleChatWindow());

        // Close chat window
        closeButton.addEventListener('click', () => this.closeChatWindow());

        // Send message when pressing Enter in input
        chatInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            ShopAIChat.Message.send(chatInput, messagesContainer);

            // On mobile, handle keyboard
            if (this.isMobile) {
              chatInput.blur();
              setTimeout(() => chatInput.focus(), 300);
            }
          }
        });

        // Send message when clicking send button
        sendButton.addEventListener('click', () => {
          if (chatInput.value.trim() !== '') {
            ShopAIChat.Message.send(chatInput, messagesContainer);

            // On mobile, focus input after sending
            if (this.isMobile) {
              setTimeout(() => chatInput.focus(), 300);
            }
          }
        });

        // Start/stop voice input
        if (voiceButton) {
          voiceButton.addEventListener('click', () => {
            ShopAIChat.Voice.toggle(chatInput, messagesContainer);
          });
        }

        // Handle window resize to adjust scrolling
        window.addEventListener('resize', () => this.scrollToBottom());

        // Add global click handler for auth links
        document.addEventListener('click', function(event) {
          if (event.target && event.target.classList.contains('shop-auth-trigger')) {
            event.preventDefault();
            if (window.shopAuthUrl) {
              ShopAIChat.Auth.openAuthPopup(window.shopAuthUrl);
            }
          }
        });
      },

      /**
       * Setup mobile-specific viewport adjustments
       */
      setupMobileViewport: function() {
        const setViewportHeight = () => {
          document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
        };
        window.addEventListener('resize', setViewportHeight);
        setViewportHeight();
      },

      /**
       * Toggle chat window visibility
       */
      toggleChatWindow: function() {
        const { chatWindow, chatInput } = this.elements;

        chatWindow.classList.toggle('active');

        if (chatWindow.classList.contains('active')) {
          // On mobile, prevent body scrolling and delay focus
          if (this.isMobile) {
            document.body.classList.add('shop-ai-chat-open');
            setTimeout(() => chatInput.focus(), 500);
          } else {
            chatInput.focus();
          }
          // Always scroll messages to bottom when opening
          this.scrollToBottom();
        } else {
          // Remove body class when closing
          document.body.classList.remove('shop-ai-chat-open');
        }
      },

      /**
       * Close chat window
       */
      closeChatWindow: function() {
        const { chatWindow, chatInput } = this.elements;

        chatWindow.classList.remove('active');
        ShopAIChat.Voice.stop();
        this.setVoiceStatus('');

        // On mobile, blur input to hide keyboard and enable body scrolling
        if (this.isMobile) {
          chatInput.blur();
          document.body.classList.remove('shop-ai-chat-open');
        }
      },

      /**
       * Scroll messages container to bottom
       */
      scrollToBottom: function() {
        const { messagesContainer } = this.elements;
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
      },

      /**
       * Show typing indicator in the chat
       */
      showTypingIndicator: function() {
        const { messagesContainer } = this.elements;

        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('shop-ai-typing-indicator');
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingIndicator);
        this.scrollToBottom();
      },

      /**
       * Remove typing indicator from the chat
       */
      removeTypingIndicator: function() {
        const { messagesContainer } = this.elements;

        const typingIndicator = messagesContainer.querySelector('.shop-ai-typing-indicator');
        if (typingIndicator) {
          typingIndicator.remove();
        }
      },

      setVoiceStatus: function(text) {
        const { voiceStatus } = this.elements;

        if (!voiceStatus) {
          return;
        }

        if (!text) {
          voiceStatus.textContent = '';
          voiceStatus.classList.remove('active');
          return;
        }

        voiceStatus.textContent = text;
        voiceStatus.classList.add('active');
      },

      /**
       * Display product results in the chat
       * @param {Array} products - Array of product data objects
       */
      displayProductResults: function(products) {
        const { messagesContainer } = this.elements;

        // Create a wrapper for the product section
        const productSection = document.createElement('div');
        productSection.classList.add('shop-ai-product-section');
        messagesContainer.appendChild(productSection);

        // Add a header for the product results
        const header = document.createElement('div');
        header.classList.add('shop-ai-product-header');
        header.innerHTML = '<h4>Top Matching Products</h4>';
        productSection.appendChild(header);

        // Create the product grid container
        const productsContainer = document.createElement('div');
        productsContainer.classList.add('shop-ai-product-grid');
        productSection.appendChild(productsContainer);

        if (!products || !Array.isArray(products) || products.length === 0) {
          const noProductsMessage = document.createElement('p');
          noProductsMessage.textContent = "No products found";
          noProductsMessage.style.padding = "10px";
          productsContainer.appendChild(noProductsMessage);
        } else {
          products.forEach(product => {
            const productCard = ShopAIChat.Product.createCard(product);
            productsContainer.appendChild(productCard);
          });
        }

        this.scrollToBottom();
      }
    },

    /**
     * Message handling and display functionality
     */
    Message: {
      /**
       * Send a message to the API
       * @param {HTMLInputElement} chatInput - The input element
       * @param {HTMLElement} messagesContainer - The messages container
       * @param {Object} options - Optional send options
       */
      send: async function(chatInput, messagesContainer, options = {}) {
        const userMessage = (options.message || chatInput.value || '').trim();
        const conversationId = sessionStorage.getItem('shopAiConversationId');

        if (!userMessage) {
          return;
        }

        // "new chat" exact match → start a new session immediately, no server call
        if (/^new chat$/i.test(userMessage)) {
          chatInput.value = '';
          ShopAIChat.Session.startNewSession(messagesContainer);
          return;
        }

        // "new chat" embedded in a longer message → ask for clarification
        if (/\bnew chat\b/i.test(userMessage)) {
          ShopAIChat.Session.showNewChatClarification(userMessage, chatInput, messagesContainer);
          return;
        }

        // "test session timeout" forces the timeout confirmation UI for manual testing
        const forceTimeout = userMessage.toLowerCase() === 'test session timeout';
        if (conversationId && (forceTimeout || ShopAIChat.Session.isExpired())) {
          ShopAIChat.Session.showTimeoutConfirmation(userMessage, chatInput, messagesContainer);
          return;
        }

        ShopAIChat.Session.updateActivity();

        // Add user message to chat
        this.add(userMessage, 'user', messagesContainer);

        // Clear input
        chatInput.value = '';

        // Show typing indicator
        ShopAIChat.UI.showTypingIndicator();

        try {
          ShopAIChat.API.streamResponse(userMessage, conversationId, messagesContainer, options.context);
        } catch (error) {
          console.error('Error communicating with Claude API:', error);
          ShopAIChat.UI.removeTypingIndicator();
          this.add("Sorry, I couldn't process your request at the moment. Please try again later.", 'assistant', messagesContainer);
        }
      },

      /**
       * Add a message to the chat
       * @param {string} text - Message content
       * @param {string} sender - Message sender ('user' or 'assistant')
       * @param {HTMLElement} messagesContainer - The messages container
       * @returns {HTMLElement} The created message element
       */
      add: function(text, sender, messagesContainer) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('shop-ai-message', sender);

        if (sender === 'assistant') {
          messageElement.dataset.rawText = text;
          ShopAIChat.Formatting.formatMessageContent(messageElement);
        } else {
          messageElement.textContent = text;
        }

        messagesContainer.appendChild(messageElement);
        ShopAIChat.UI.scrollToBottom();

        return messageElement;
      },

      /**
       * Add a tool use message to the chat with expandable arguments
       * @param {string} toolMessage - Tool use message content
       * @param {HTMLElement} messagesContainer - The messages container
       */
      addToolUse: function(toolMessage, messagesContainer) {
        // Parse the tool message to extract tool name and arguments
        const match = toolMessage.match(/Calling tool: (\w+) with arguments: (.+)/);
        if (!match) {
          // Fallback for unexpected format
          const toolUseElement = document.createElement('div');
          toolUseElement.classList.add('shop-ai-message', 'tool-use');
          toolUseElement.textContent = toolMessage;
          messagesContainer.appendChild(toolUseElement);
          ShopAIChat.UI.scrollToBottom();
          return;
        }

        const toolName = match[1];
        const argsString = match[2];

        // Create the main tool use element
        const toolUseElement = document.createElement('div');
        toolUseElement.classList.add('shop-ai-message', 'tool-use');

        // Create the header (always visible)
        const headerElement = document.createElement('div');
        headerElement.classList.add('shop-ai-tool-header');

        const toolText = document.createElement('span');
        toolText.classList.add('shop-ai-tool-text');
        toolText.textContent = `Calling tool: ${toolName}`;

        const toggleElement = document.createElement('span');
        toggleElement.classList.add('shop-ai-tool-toggle');
        toggleElement.textContent = '[+]';

        headerElement.appendChild(toolText);
        headerElement.appendChild(toggleElement);

        // Create the arguments section (initially hidden)
        const argsElement = document.createElement('div');
        argsElement.classList.add('shop-ai-tool-args');

        try {
          // Try to format JSON arguments nicely
          const parsedArgs = JSON.parse(argsString);
          argsElement.textContent = JSON.stringify(parsedArgs, null, 2);
        } catch (e) {
          // If not valid JSON, just show as-is
          argsElement.textContent = argsString;
        }

        // Add click handler to toggle arguments visibility
        headerElement.addEventListener('click', function() {
          const isExpanded = argsElement.classList.contains('expanded');
          if (isExpanded) {
            argsElement.classList.remove('expanded');
            toggleElement.textContent = '[+]';
          } else {
            argsElement.classList.add('expanded');
            toggleElement.textContent = '[-]';
          }
        });

        // Assemble the complete element
        toolUseElement.appendChild(headerElement);
        toolUseElement.appendChild(argsElement);

        messagesContainer.appendChild(toolUseElement);
        ShopAIChat.UI.scrollToBottom();
      }
    },

    /**
     * Browser voice input using Web Speech API
     */
    Voice: {
      recognition: null,
      isRecording: false,

      getLabels: function() {
        return window.shopChatConfig?.voiceLabels || {};
      },

      getRecognitionConstructor: function() {
        return window.SpeechRecognition || window.webkitSpeechRecognition;
      },

      isSupported: function() {
        return Boolean(this.getRecognitionConstructor());
      },

      toggle: function(chatInput, messagesContainer) {
        if (this.isRecording || ShopAIChat.VoiceAnalysis.isRecording) {
          this.stop();
          return;
        }

        this.start(chatInput, messagesContainer);
      },

      start: function(chatInput, messagesContainer) {
        // Route to server-side pipeline when voice analysis is enabled
        if (window.shopChatConfig?.voiceAnalysisEnabled) {
          ShopAIChat.VoiceAnalysis.start(chatInput, messagesContainer);
          return;
        }

        const RecognitionCtor = this.getRecognitionConstructor();
        const labels = this.getLabels();

        if (!RecognitionCtor) {
          ShopAIChat.Message.add(
            labels.voiceUnsupported || 'Voice input is not supported in this browser. Try Chrome, Edge, or Safari and ensure HTTPS.',
            'assistant',
            messagesContainer
          );
          return;
        }

        if (!this.recognition) {
          this.recognition = new RecognitionCtor();
          this.recognition.lang = 'en-US';
          this.recognition.continuous = false;
          this.recognition.interimResults = false;
          this.recognition.maxAlternatives = 1;

          this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateButtonState(true);
            ShopAIChat.UI.setVoiceStatus(labels.voiceListening || 'Listening...');
          };

          this.recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript?.trim();

            if (!transcript) {
              ShopAIChat.Message.add(labels.voiceNoSpeech || "I couldn't hear anything. Please try again.", 'assistant', messagesContainer);
              return;
            }

            chatInput.value = transcript;
            ShopAIChat.Message.send(chatInput, messagesContainer);
          };

          this.recognition.onnomatch = () => {
            ShopAIChat.Message.add(
              labels.voiceNoSpeech || "I couldn't understand that. Please try speaking more clearly.",
              'assistant',
              messagesContainer
            );
          };

          this.recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
              ShopAIChat.Message.add(labels.voiceNoSpeech || "I couldn't hear anything. Please try again.", 'assistant', messagesContainer);
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              ShopAIChat.Message.add('Microphone access is blocked. Allow microphone permission in your browser settings, then try again.', 'assistant', messagesContainer);
            } else if (event.error === 'audio-capture') {
              ShopAIChat.Message.add('No microphone was detected. Check your mic connection and system input device.', 'assistant', messagesContainer);
            } else if (event.error === 'network') {
              ShopAIChat.Message.add('Speech recognition network error. Check your internet connection and try again.', 'assistant', messagesContainer);
            } else if (event.error !== 'aborted') {
              ShopAIChat.Message.add(`Voice input failed (${event.error || 'unknown error'}). Please try again.`, 'assistant', messagesContainer);
            }
          };

          this.recognition.onend = () => {
            this.isRecording = false;
            this.updateButtonState(false);
            ShopAIChat.UI.setVoiceStatus('');
          };
        }

        this.isRecording = true;
        this.updateButtonState(true);

        try {
          this.recognition.start();
        } catch (error) {
          this.isRecording = false;
          this.updateButtonState(false);
          ShopAIChat.UI.setVoiceStatus('');
          ShopAIChat.Message.add('Voice input failed to start. Please try again.', 'assistant', messagesContainer);
        }
      },

      stop: function() {
        if (this.recognition && this.isRecording) {
          this.recognition.stop();
        }
        ShopAIChat.VoiceAnalysis.stop();
      },

      updateButtonState: function(isRecording) {
        const voiceButton = ShopAIChat.UI.elements.voiceButton;
        const labels = this.getLabels();

        if (!voiceButton) {
          return;
        }

        voiceButton.classList.toggle('recording', isRecording);

        const buttonLabel = isRecording
          ? (labels.voiceButtonRecording || 'Stop voice input')
          : (labels.voiceButton || 'Use voice input');

        voiceButton.setAttribute('title', buttonLabel);
        voiceButton.setAttribute('aria-label', buttonLabel);
      }
    },

    /**
     * Server-side voice analysis using MediaRecorder + /api/transcribe.
     * Used when window.shopChatConfig.voiceAnalysisEnabled === true.
     * Falls back to a no-op if MediaRecorder is unavailable.
     */
    VoiceAnalysis: {
      mediaRecorder: null,
      audioChunks: [],
      isRecording: false,
      CONSENT_KEY: 'shopAiVoiceAnalysisConsent',

      hasConsent: function() {
        try {
          return localStorage.getItem(this.CONSENT_KEY) === 'true';
        } catch {
          return false;
        }
      },

      saveConsent: function() {
        try { localStorage.setItem(this.CONSENT_KEY, 'true'); } catch { /* ignore */ }
      },

      isSupported: function() {
        return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
      },

      start: function(chatInput, messagesContainer) {
        if (!this.isSupported()) {
          ShopAIChat.Message.add(
            'Server-side voice analysis requires a browser with MediaRecorder support.',
            'assistant', messagesContainer
          );
          return;
        }

        if (!this.hasConsent()) {
          this._requestConsent(chatInput, messagesContainer);
          return;
        }

        this._beginRecording(chatInput, messagesContainer);
      },

      stop: function() {
        if (this.mediaRecorder && this.isRecording) {
          this.mediaRecorder.stop();
        }
      },

      _requestConsent: function(chatInput, messagesContainer) {
        const notice = document.createElement('div');
        notice.classList.add('shop-ai-message', 'assistant', 'shop-ai-voice-consent');
        notice.innerHTML =
          '<p>Your voice will be analyzed to personalize your experience (speech-to-text and optional demographic signals). ' +
          'No raw audio is stored.</p>' +
          '<button class="shop-ai-consent-allow">Allow</button>' +
          '<button class="shop-ai-consent-deny">No thanks</button>';
        messagesContainer.appendChild(notice);
        ShopAIChat.UI.scrollToBottom();

        notice.querySelector('.shop-ai-consent-allow').addEventListener('click', () => {
          notice.remove();
          this.saveConsent();
          this._beginRecording(chatInput, messagesContainer);
        });

        notice.querySelector('.shop-ai-consent-deny').addEventListener('click', () => {
          notice.remove();
          ShopAIChat.Message.add("No problem — you can still type your questions.", 'assistant', messagesContainer);
        });
      },

      _beginRecording: async function(chatInput, messagesContainer) {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          let msg;
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Microphone access is blocked. In Safari: tap the website settings (AA) in the address bar → Microphone → Allow, then reload the page.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No microphone detected. Check your mic connection and try again.';
          } else if (err.name === 'SecurityError') {
            msg = 'Microphone access requires a secure (HTTPS) connection.';
          } else {
            msg = `Microphone error (${err.name}): ${err.message}. Please try again or type your message.`;
          }
          ShopAIChat.Message.add(msg, 'assistant', messagesContainer);
          return;
        }

        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream);
        this.isRecording = true;
        ShopAIChat.Voice.updateButtonState(true);
        ShopAIChat.UI.setVoiceStatus('Listening...');

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };

        this.mediaRecorder.onstop = async () => {
          this.isRecording = false;
          ShopAIChat.Voice.updateButtonState(false);
          ShopAIChat.UI.setVoiceStatus('Processing...');

          stream.getTracks().forEach(t => t.stop());

          const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });

          if (audioBlob.size === 0) {
            ShopAIChat.UI.setVoiceStatus('');
            ShopAIChat.Message.add("No audio captured. Please try again.", 'assistant', messagesContainer);
            return;
          }

          await this._sendToTranscribe(audioBlob, mimeType, chatInput, messagesContainer);
        };

        this.mediaRecorder.start();
      },

      _sendToTranscribe: async function(audioBlob, mimeType, chatInput, messagesContainer) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');

        try {
          const { response } = await ShopAIChat.fetchFromApi('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          ShopAIChat.UI.setVoiceStatus('');

          if (!response.ok) {
            ShopAIChat.Message.add('Voice transcription failed. Please try typing instead.', 'assistant', messagesContainer);
            return;
          }

          const { transcript, demographics } = await response.json();

          if (!transcript || transcript.trim() === '') {
            ShopAIChat.Message.add("I couldn't hear anything. Please try again.", 'assistant', messagesContainer);
            return;
          }

          chatInput.value = transcript;

          const context = demographics ? { demographics } : undefined;
          ShopAIChat.Message.send(chatInput, messagesContainer, { message: transcript, context });
        } catch (err) {
          ShopAIChat.UI.setVoiceStatus('');
          ShopAIChat.Message.add('Voice transcription failed. Please try typing instead.', 'assistant', messagesContainer);
        }
      }
    },

    /**
     * Session lifecycle management: activity tracking and timeout confirmation
     */
    Session: {
      TIMEOUT_MS: 15 * 60 * 1000,
      ACTIVITY_KEY: 'shopAiLastActivity',

      updateActivity: function() {
        try { sessionStorage.setItem(this.ACTIVITY_KEY, Date.now().toString()); } catch { /* ignore */ }
      },

      isExpired: function() {
        try {
          const last = sessionStorage.getItem(this.ACTIVITY_KEY);
          if (!last) return false;
          return (Date.now() - parseInt(last, 10)) > this.TIMEOUT_MS;
        } catch { return false; }
      },

      showTimeoutConfirmation: function(userMessage, chatInput, messagesContainer) {
        chatInput.value = userMessage;

        const confirmDiv = document.createElement('div');
        confirmDiv.classList.add('shop-ai-message', 'assistant', 'shop-ai-session-timeout');
        confirmDiv.innerHTML =
          '<p>Your session has been inactive for a while. Would you like to continue where you left off, or start a new conversation?</p>' +
          '<div class="shop-ai-session-buttons">' +
            '<button class="shop-ai-session-continue">Continue Conversation</button>' +
            '<button class="shop-ai-session-new">Start New Conversation</button>' +
          '</div>' +
          '<p class="shop-ai-session-hint">Tip: Type <strong>new chat</strong> on its own at any time to start a fresh conversation.</p>';

        messagesContainer.appendChild(confirmDiv);
        ShopAIChat.UI.scrollToBottom();

        var self = this;

        confirmDiv.querySelector('.shop-ai-session-continue').addEventListener('click', function() {
          confirmDiv.remove();
          self.updateActivity();
          var conversationId = sessionStorage.getItem('shopAiConversationId');
          ShopAIChat.Message.add(userMessage, 'user', messagesContainer);
          chatInput.value = '';
          ShopAIChat.UI.showTypingIndicator();
          ShopAIChat.API.streamResponse(userMessage, conversationId, messagesContainer);
        });

        confirmDiv.querySelector('.shop-ai-session-new').addEventListener('click', function() {
          confirmDiv.remove();
          chatInput.value = '';
          self.startNewSession(messagesContainer);
        });
      },

      startNewSession: function(messagesContainer) {
        sessionStorage.removeItem('shopAiConversationId');
        this.updateActivity();
        messagesContainer.innerHTML = '';
        var welcomeMsg = window.shopChatConfig && window.shopChatConfig.welcomeMessage
          ? window.shopChatConfig.welcomeMessage
          : '👋 Hi there! How can I help you today?';
        ShopAIChat.Message.add(welcomeMsg, 'assistant', messagesContainer);
      },

      showNewChatClarification: function(originalMessage, chatInput, messagesContainer) {
        chatInput.value = originalMessage;

        const clarifyDiv = document.createElement('div');
        clarifyDiv.classList.add('shop-ai-message', 'assistant', 'shop-ai-session-timeout');
        clarifyDiv.innerHTML =
          '<p>It looks like your message includes "new chat." Did you want to clear your chat history and start a new conversation?</p>' +
          '<div class="shop-ai-session-buttons">' +
            '<button class="shop-ai-session-continue">No, send my full message</button>' +
            '<button class="shop-ai-session-new">Yes, start a new chat</button>' +
          '</div>' +
          '<p class="shop-ai-session-hint">Tip: Type <strong>new chat</strong> on its own to start fresh without any extra wording.</p>';

        messagesContainer.appendChild(clarifyDiv);
        ShopAIChat.UI.scrollToBottom();

        var self = this;
        var conversationId = sessionStorage.getItem('shopAiConversationId');

        clarifyDiv.querySelector('.shop-ai-session-continue').addEventListener('click', function() {
          clarifyDiv.remove();
          self.updateActivity();
          ShopAIChat.Message.add(originalMessage, 'user', messagesContainer);
          chatInput.value = '';
          ShopAIChat.UI.showTypingIndicator();
          ShopAIChat.API.streamResponse(originalMessage, conversationId, messagesContainer);
        });

        clarifyDiv.querySelector('.shop-ai-session-new').addEventListener('click', function() {
          clarifyDiv.remove();
          chatInput.value = '';
          self.startNewSession(messagesContainer);
        });
      }
    },

    /**
     * Text formatting and markdown handling
     */
    Formatting: {
      /**
       * Format message content with markdown and links
       * @param {HTMLElement} element - The element to format
       */
      formatMessageContent: function(element) {
        if (!element || !element.dataset.rawText) return;

        const rawText = element.dataset.rawText;

        // Process the text with various Markdown features
        let processedText = rawText;

        // Process Markdown links
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        processedText = processedText.replace(markdownLinkRegex, (match, text, url) => {
          // Check if it's an auth URL
          if (url.includes('shopify.com/authentication') &&
             (url.includes('oauth/authorize') || url.includes('authentication'))) {
            // Store the auth URL in a global variable for later use - this avoids issues with onclick handlers
            window.shopAuthUrl = url;
            // Just return normal link that will be handled by the document click handler
            return '<a href="#auth" class="shop-auth-trigger">' + text + '</a>';
          }
          // If it's a checkout link, replace the text
          else if (url.includes('/cart') || url.includes('checkout')) {
            return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">click here to proceed to checkout</a>';
          } else {
            // For normal links, preserve the original text
            return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
          }
        });

        // Convert text to HTML with proper list handling
        processedText = this.convertMarkdownToHtml(processedText);

        // Apply the formatted HTML
        element.innerHTML = processedText;
      },

      /**
       * Convert Markdown text to HTML with list support
       * @param {string} text - Markdown text to convert
       * @returns {string} HTML content
       */
      convertMarkdownToHtml: function(text) {
        text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
        const lines = text.split('\n');
        let currentList = null;
        let listItems = [];
        let htmlContent = '';
        let startNumber = 1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const unorderedMatch = line.match(/^\s*([-*])\s+(.*)/);
          const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)/);

          if (unorderedMatch) {
            if (currentList !== 'ul') {
              if (currentList === 'ol') {
                htmlContent += `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
                listItems = [];
              }
              currentList = 'ul';
            }
            listItems.push('<li>' + unorderedMatch[2] + '</li>');
          } else if (orderedMatch) {
            if (currentList !== 'ol') {
              if (currentList === 'ul') {
                htmlContent += '<ul>' + listItems.join('') + '</ul>';
                listItems = [];
              }
              currentList = 'ol';
              startNumber = parseInt(orderedMatch[1], 10);
            }
            listItems.push('<li>' + orderedMatch[2] + '</li>');
          } else {
            if (currentList) {
              htmlContent += currentList === 'ul'
                ? '<ul>' + listItems.join('') + '</ul>'
                : `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
              listItems = [];
              currentList = null;
            }

            if (line.trim() === '') {
              htmlContent += '<br>';
            } else {
              htmlContent += '<p>' + line + '</p>';
            }
          }
        }

        if (currentList) {
          htmlContent += currentList === 'ul'
            ? '<ul>' + listItems.join('') + '</ul>'
            : `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
        }

        htmlContent = htmlContent.replace(/<\/p><p>/g, '</p>\n<p>');
        return htmlContent;
      }
    },

    /**
     * API communication and data handling
     */
    API: {
      /**
       * Stream a response from the API
       * @param {string} userMessage - User's message text
       * @param {string} conversationId - Conversation ID for context
       * @param {HTMLElement} messagesContainer - The messages container
       */
      streamResponse: async function(userMessage, conversationId, messagesContainer, context) {
        let currentMessageElement = null;

        try {
          const promptType = window.shopChatConfig?.promptType || "standardAssistant";
          const requestPayload = {
            message: userMessage,
            conversation_id: conversationId,
            prompt_type: promptType
          };

          if (context && typeof context === 'object') {
            requestPayload.context = context;
          }

          const requestBody = JSON.stringify(requestPayload);

          const shopId = window.shopId;

          const { response, url } = await ShopAIChat.fetchFromApi('/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              'X-Shopify-Shop-Id': shopId
            },
            body: requestBody
          });

          if (!response.ok || !response.body) {
            throw new Error(`Chat request failed (${response.status})`);
          }

          console.log('Connected to chat API:', url);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          // Create initial message element
          let messageElement = document.createElement('div');
          messageElement.classList.add('shop-ai-message', 'assistant');
          messageElement.textContent = '';
          messageElement.dataset.rawText = '';
          messagesContainer.appendChild(messageElement);
          currentMessageElement = messageElement;

          // Process the stream
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  this.handleStreamEvent(data, currentMessageElement, messagesContainer, userMessage,
                    (newElement) => { currentMessageElement = newElement; });
                } catch (e) {
                  console.error('Error parsing event data:', e, line);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in streaming:', error);
          ShopAIChat.UI.removeTypingIndicator();
          ShopAIChat.Message.add("Sorry, I couldn't reach the chat service. Verify the Chat API Base URL in the theme app extension settings.",
            'assistant', messagesContainer);
        }
      },

      /**
       * Handle stream events from the API
       * @param {Object} data - Event data
       * @param {HTMLElement} currentMessageElement - Current message element being updated
       * @param {HTMLElement} messagesContainer - The messages container
       * @param {string} userMessage - The original user message
       * @param {Function} updateCurrentElement - Callback to update the current element reference
       */
      handleStreamEvent: function(data, currentMessageElement, messagesContainer, userMessage, updateCurrentElement) {
        switch (data.type) {
          case 'id':
            if (data.conversation_id) {
              sessionStorage.setItem('shopAiConversationId', data.conversation_id);
            }
            break;

          case 'new_session':
            if (data.conversation_id) {
              sessionStorage.setItem('shopAiConversationId', data.conversation_id);
              ShopAIChat.Session.updateActivity();
              // Clear the chat UI and show a fresh welcome message
              messagesContainer.innerHTML = '';
              const welcomeMsg = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
              ShopAIChat.Message.add(welcomeMsg, 'assistant', messagesContainer);
              // Re-attach the current element so incoming chunk events still render
              messagesContainer.appendChild(currentMessageElement);
            }
            break;

          case 'chunk':
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.dataset.rawText += data.chunk;
            currentMessageElement.textContent = currentMessageElement.dataset.rawText;
            ShopAIChat.UI.scrollToBottom();
            break;

          case 'message_complete':
            ShopAIChat.UI.removeTypingIndicator();
            ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
            ShopAIChat.UI.scrollToBottom();
            break;

          case 'end_turn':
            ShopAIChat.UI.removeTypingIndicator();
            ShopAIChat.Session.updateActivity();
            break;

          case 'error':
            console.error('Stream error:', data.error);
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.textContent = "Sorry, I couldn't process your request. Please try again later.";
            break;

          case 'rate_limit_exceeded':
            console.error('Rate limit exceeded:', data.error);
            ShopAIChat.UI.removeTypingIndicator();
            currentMessageElement.textContent = "Sorry, our servers are currently busy. Please try again later.";
            break;

          case 'auth_required':
            // Save the last user message for resuming after authentication
            sessionStorage.setItem('shopAiLastMessage', userMessage || '');
            break;

          case 'product_results':
            ShopAIChat.UI.displayProductResults(data.products);
            break;

          case 'tool_use':
            if (data.tool_use_message) {
              ShopAIChat.Message.addToolUse(data.tool_use_message, messagesContainer);
            }
            break;

          case 'new_message': {
            ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
            ShopAIChat.UI.showTypingIndicator();

            // Create new message element for the next response
            const newMessageElement = document.createElement('div');
            newMessageElement.classList.add('shop-ai-message', 'assistant');
            newMessageElement.textContent = '';
            newMessageElement.dataset.rawText = '';
            messagesContainer.appendChild(newMessageElement);

            // Update the current element reference
            updateCurrentElement(newMessageElement);
            break;
          }

          case 'content_block_complete':
            ShopAIChat.UI.showTypingIndicator();
            break;
        }
      },

      /**
       * Fetch chat history from the server
       * @param {string} conversationId - Conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      fetchChatHistory: async function(conversationId, messagesContainer) {
        try {
          // Show a loading message
          const loadingMessage = document.createElement('div');
          loadingMessage.classList.add('shop-ai-message', 'assistant');
          loadingMessage.textContent = "Loading conversation history...";
          messagesContainer.appendChild(loadingMessage);

          // Fetch history from the server
          const historyPath = `/chat?history=true&conversation_id=${encodeURIComponent(conversationId)}`;
          const { response, url: historyUrl } = await ShopAIChat.fetchFromApi(historyPath, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          });

          console.log('Fetching history from:', historyUrl);

          if (!response.ok) {
            console.error('History fetch failed:', response.status, response.statusText);
            throw new Error('Failed to fetch chat history: ' + response.status);
          }

          const data = await response.json();

          // Remove loading message
          messagesContainer.removeChild(loadingMessage);

          // No messages, show welcome message
          if (!data.messages || data.messages.length === 0) {
            const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
            ShopAIChat.Message.add(welcomeMessage, 'assistant', messagesContainer);
            return;
          }

          // Add messages to the UI - filter out tool results
          data.messages.forEach(message => {
            try {
              const messageContents = JSON.parse(message.content);
              for (const contentBlock of messageContents) {
                if (contentBlock.type === 'text') {
                  ShopAIChat.Message.add(contentBlock.text, message.role, messagesContainer);
                }
              }
            } catch (e) {
              ShopAIChat.Message.add(message.content, message.role, messagesContainer);
            }
          });

          // Scroll to bottom
          ShopAIChat.UI.scrollToBottom();

        } catch (error) {
          console.error('Error fetching chat history:', error);

          // Remove loading message if it exists
          const loadingMessage = messagesContainer.querySelector('.shop-ai-message.assistant');
          if (loadingMessage && loadingMessage.textContent === "Loading conversation history...") {
            messagesContainer.removeChild(loadingMessage);
          }

          // Show error and welcome message
          const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
          ShopAIChat.Message.add(welcomeMessage, 'assistant', messagesContainer);

          // Clear the conversation ID since we couldn't fetch this conversation
          sessionStorage.removeItem('shopAiConversationId');
        }
      }
    },

    /**
     * Authentication-related functionality
     */
    Auth: {
      /**
       * Opens an authentication popup window
       * @param {string|HTMLElement} authUrlOrElement - The auth URL or link element that was clicked
       */
      openAuthPopup: function(authUrlOrElement) {
        let authUrl;
        if (typeof authUrlOrElement === 'string') {
          // If a string URL was passed directly
          authUrl = authUrlOrElement;
        } else {
          // If an element was passed
          authUrl = authUrlOrElement.getAttribute('data-auth-url');
          if (!authUrl) {
            console.error('No auth URL found in element');
            return;
          }
        }

        // Open the popup window centered in the screen
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;

        const popup = window.open(
          authUrl,
          'ShopifyAuth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );

        // Focus the popup window
        if (popup) {
          popup.focus();
        } else {
          // If popup was blocked, show a message
          alert('Please allow popups for this site to authenticate with Shopify.');
        }

        // Start polling for token availability
        const conversationId = sessionStorage.getItem('shopAiConversationId');
        if (conversationId) {
          const messagesContainer = document.querySelector('.shop-ai-chat-messages');

          // Add a message to indicate authentication is in progress
          ShopAIChat.Message.add("Authentication in progress. Please complete the process in the popup window.",
            'assistant', messagesContainer);

          this.startTokenPolling(conversationId, messagesContainer);
        }
      },

      /**
       * Start polling for token availability
       * @param {string} conversationId - Conversation ID
       * @param {HTMLElement} messagesContainer - The messages container
       */
      startTokenPolling: function(conversationId, messagesContainer) {
        if (!conversationId) return;

        console.log('Starting token polling for conversation:', conversationId);
        const pollingId = 'polling_' + Date.now();
        sessionStorage.setItem('shopAiTokenPollingId', pollingId);

        let attemptCount = 0;
        const maxAttempts = 30;

        const poll = async () => {
          if (sessionStorage.getItem('shopAiTokenPollingId') !== pollingId) {
            console.log('Another polling session has started, stopping this one');
            return;
          }

          if (attemptCount >= maxAttempts) {
            console.log('Max polling attempts reached, stopping');
            return;
          }

          attemptCount++;

          try {
            const tokenPath = `/auth/token-status?conversation_id=${encodeURIComponent(conversationId)}`;
            const { response } = await ShopAIChat.fetchFromApi(tokenPath, {
              method: 'GET'
            });

            if (!response.ok) {
              throw new Error('Token status check failed: ' + response.status);
            }

            const data = await response.json();

            if (data.status === 'authorized') {
              console.log('Token available, resuming conversation');
              const message = sessionStorage.getItem('shopAiLastMessage');

              if (message) {
                sessionStorage.removeItem('shopAiLastMessage');
                setTimeout(() => {
                  ShopAIChat.Message.add("Authorization successful! I'm now continuing with your request.",
                    'assistant', messagesContainer);
                  ShopAIChat.API.streamResponse(message, conversationId, messagesContainer);
                  ShopAIChat.UI.showTypingIndicator();
                }, 500);
              }

              sessionStorage.removeItem('shopAiTokenPollingId');
              return;
            }

            console.log('Token not available yet, polling again in 10s');
            setTimeout(poll, 10000);
          } catch (error) {
            console.error('Error polling for token status:', error);
            setTimeout(poll, 10000);
          }
        };

        setTimeout(poll, 2000);
      }
    },

    /**
     * Product-related functionality
     */
    Product: {
      /**
       * Create a product card element
       * @param {Object} product - Product data
       * @returns {HTMLElement} Product card element
       */
      createCard: function(product) {
        const card = document.createElement('div');
        card.classList.add('shop-ai-product-card');

        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('shop-ai-product-image');

        // Add product image or placeholder
        const image = document.createElement('img');
        image.src = product.image_url || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
        image.alt = product.title;
        image.onerror = function() {
          // If image fails to load, use a fallback placeholder
          this.src = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
        };
        imageContainer.appendChild(image);
        card.appendChild(imageContainer);

        // Add product info
        const info = document.createElement('div');
        info.classList.add('shop-ai-product-info');

        // Add product title
        const title = document.createElement('h3');
        title.classList.add('shop-ai-product-title');
        title.textContent = product.title;

        // If product has a URL, make the title a link
        if (product.url) {
          const titleLink = document.createElement('a');
          titleLink.href = product.url;
          titleLink.target = '_blank';
          titleLink.textContent = product.title;
          title.textContent = '';
          title.appendChild(titleLink);
        }

        info.appendChild(title);

        // Add product price
        const price = document.createElement('p');
        price.classList.add('shop-ai-product-price');
        price.textContent = product.price;
        info.appendChild(price);

        // Add add-to-cart button
        const button = document.createElement('button');
        button.classList.add('shop-ai-add-to-cart');
        button.textContent = 'Add to Cart';
        button.dataset.productId = product.id;

        // Add click handler for the button
        button.addEventListener('click', function() {
          // Send message to add this product to cart
          const input = document.querySelector('.shop-ai-chat-input input');
          if (input) {
            input.value = `Add ${product.title} to my cart`;
            // Trigger a click on the send button
            const sendButton = document.querySelector('.shop-ai-chat-send');
            if (sendButton) {
              sendButton.click();
            }
          }
        });

        info.appendChild(button);
        card.appendChild(info);

        return card;
      }
    },

    /**
     * Initialize the chat application
     */
    init: function() {
      // Initialize UI
      const container = document.querySelector('.shop-ai-chat-container');
      if (!container) return;

      this.UI.init(container);

      const voiceButton = this.UI.elements.voiceButton;
      if (voiceButton) {
        if (!this.Voice.isSupported()) {
          voiceButton.classList.add('unsupported');
        }
        this.Voice.updateButtonState(false);
      }

      // Check for existing conversation
      const conversationId = sessionStorage.getItem('shopAiConversationId');

      if (conversationId) {
        // Fetch conversation history
        this.API.fetchChatHistory(conversationId, this.UI.elements.messagesContainer);
      } else {
        // No previous conversation, show welcome message
        const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
        this.Message.add(welcomeMessage, 'assistant', this.UI.elements.messagesContainer);
      }
    }
  };

  // Initialize the application when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    ShopAIChat.init();
  });
})();
