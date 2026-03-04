(() => {
	// Prevent double-injection
	if (window.__GriffFocusInjected) return;
	window.__GriffFocusInjected = true;

	const Griff_IMG = chrome.runtime.getURL('assets/griff.png');

	// ─── Warning messages the Griff can say ───
	const ANGRY_MESSAGES = [
		'Hey there—remember what you meant to focus on.',
		'A gentle reminder: your task is waiting.',
		"Let's return to your work—you've got this.",
		"This doesn't seem part of your current plan.",
		'I believe you intended to stay on task.',
		'The Griff suggests returning to your objective.',
		"I'm keeping watch—shall we head back?",
		'SQUAWK! A small detour—time to refocus.',
		'Just checking in—ready to continue?',
		"Focus mode is active—let's honor that commitment.",
		'The Griff encourages you to continue your quest.'
	];

	let GriffEl = null;
	let speechBubble = null;
	let _countdownEl = null;
	let warningTimeout = null;
	let countdownInterval = null;
	let isBlocked = false;
	let isDragging = false;
	let wanderInterval = null;
	let desktopAppActive = false;
	const dragOffset = { x: 0, y: 0 };
	let currentX = 0;
	let currentY = 0;
	let targetY = 0;
	let dragCount = 0;
	let dragResetTimeout = null;
	let clickCount = 0;
	let clickResetTimeout = null;

	// ─── Create the floating Griff ───
	function createGriff() {
		if (GriffEl) return;
		// Ensure body exists before creating Griff
		if (!document.body) {
			// Wait for body to be available
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', createGriff, { once: true });
			}
			return;
		}

		GriffEl = document.createElement('div');
		GriffEl.id = 'Griff-focus-container';

		const img = document.createElement('img');
		img.src = Griff_IMG;
		img.id = 'Griff-focus-img';
		img.draggable = false;

		speechBubble = document.createElement('div');
		speechBubble.id = 'Griff-speech-bubble';
		speechBubble.classList.add('Griff-hidden');

		GriffEl.appendChild(speechBubble);
		GriffEl.appendChild(img);
		document.body.appendChild(GriffEl);

		// Position at bottom and start wandering
		GriffEl.style.position = 'fixed';
		GriffEl.style.bottom = '20px';
		GriffEl.style.left = '50px';
		currentX = 50;
		currentY = window.innerHeight - 100;
		targetY = window.innerHeight - 100;
		startWandering();

		// Make draggable
		GriffEl.addEventListener('mousedown', startDrag);
		document.addEventListener('mousemove', onDrag);
		document.addEventListener('mouseup', endDrag);

		// Open chat on triple-click (if not dragging)
		GriffEl.addEventListener('click', () => {
			if (isDragging) return;

			clickCount++;

			// Reset click count after 2 seconds of inactivity
			if (clickResetTimeout) clearTimeout(clickResetTimeout);
			clickResetTimeout = setTimeout(() => {
				clickCount = 0;
			}, 2000);

			// Open chat after 3 clicks
			if (clickCount >= 3) {
				clickCount = 0;
				clearTimeout(clickResetTimeout);
				openChat();
			}
		});
	}

	function removeGriff() {
		clearTimers();
		stopWandering();
		if (GriffEl) {
			GriffEl.remove();
			GriffEl = null;
			speechBubble = null;
			_countdownEl = null;
		}
		if (clickResetTimeout) {
			clearTimeout(clickResetTimeout);
			clickResetTimeout = null;
		}
		clickCount = 0;
		isBlocked = false;
	}

	// ─── Drag logic ───
	function startDrag(e) {
		isDragging = true;
		stopWandering();
		const rect = GriffEl.getBoundingClientRect();
		dragOffset.x = e.clientX - rect.left;
		dragOffset.y = e.clientY - rect.top;
		GriffEl.style.transition = 'none';

		// Track drag count for detecting harassment
		dragCount++;
		if (dragCount === 1) {
			// Start counting window – reset after 5 seconds of no drags
			if (dragResetTimeout) clearTimeout(dragResetTimeout);
			dragResetTimeout = setTimeout(() => {
				dragCount = 0;
			}, 8000);
		}
		// If dragged 4+ times in 8 seconds, go angry
		if (dragCount >= 10 && !isBlocked) {
			dragCount = 0;
			goAngryNoClose();
		}
	}
	function onDrag(e) {
		if (!isDragging || !GriffEl) return;
		const newX = e.clientX - dragOffset.x;
		const newY = e.clientY - dragOffset.y;
		const minX = 0;
		const maxX = window.innerWidth - 80;
		currentX = Math.max(minX, Math.min(newX, maxX));
		currentY = newY;
		GriffEl.style.left = `${currentX}px`;
		GriffEl.style.top = `${currentY}px`;
		GriffEl.style.right = 'auto';
		GriffEl.style.bottom = 'auto';
	}
	function endDrag() {
		isDragging = false;
		if (GriffEl) {
			GriffEl.style.transition = 'top 1.6s ease-out, left 0.15s ease-out';
			if (currentY < window.innerHeight - 150) {
				targetY = window.innerHeight - 100;
			} else {
				targetY = window.innerHeight - 100;
			}
			GriffEl.style.top = `${targetY}px`;
			currentY = targetY;
		}
		setTimeout(startWandering, 600);
	}

	// ─── Angry mode ───
	function goAngry() {
		if (!GriffEl) return;
		isBlocked = true;

		GriffEl.classList.add('Griff-angry');

		// Show speech bubble with random message
		const msg = ANGRY_MESSAGES[Math.floor(Math.random() * ANGRY_MESSAGES.length)];
		speechBubble.textContent = msg;
		speechBubble.classList.remove('Griff-hidden');

		// Start 10-second countdown timer
		let seconds = 10;

		countdownInterval = setInterval(() => {
			seconds--;
			if (seconds <= 0) {
				clearTimers();
				closeTab();
			} else {
				// Intensify shaking at lower counts
				if (seconds <= 3) {
					GriffEl.classList.add('Griff-rage');
				}
			}
		}, 1000);
	}

	function goAngryNoClose() {
		if (!GriffEl) return;

		GriffEl.classList.add('Griff-angry');

		// Show speech bubble with random message
		const msg = ANGRY_MESSAGES[Math.floor((Math.random() * ANGRY_MESSAGES.length) / 2)];
		speechBubble.textContent = msg;
		speechBubble.classList.remove('Griff-hidden');

		// Shake for 2 seconds then calm down
		GriffEl.classList.add('Griff-rage');
		warningTimeout = setTimeout(() => {
			goCalm();
		}, 2000);
	}

	function goCalm() {
		if (!GriffEl) return;
		isBlocked = false;
		clearTimers();

		GriffEl.classList.remove('Griff-angry', 'Griff-rage');
		speechBubble.classList.add('Griff-hidden');
	}

	function clearTimers() {
		if (warningTimeout) {
			clearTimeout(warningTimeout);
			warningTimeout = null;
		}
		if (countdownInterval) {
			clearInterval(countdownInterval);
			countdownInterval = null;
		}
		if (dragResetTimeout) {
			clearTimeout(dragResetTimeout);
			dragResetTimeout = null;
		}
	}

	// ─── Autonomous wandering ───
	function startWandering() {
		if (wanderInterval || isDragging) return;
		wanderInterval = setInterval(() => {
			if (isDragging || !GriffEl) return;
			const moveAmount = (Math.random() - 0.5) * 80;
			const newX = currentX + moveAmount;
			const minX = 0;
			const maxX = window.innerWidth - 80;
			currentX = Math.max(minX, Math.min(newX, maxX));
			GriffEl.style.transition = 'left 0.8s ease-in-out';
			GriffEl.style.left = `${currentX}px`;
		}, 2000);
	}

	function stopWandering() {
		if (wanderInterval) {
			clearInterval(wanderInterval);
			wanderInterval = null;
		}
	}

	function closeTab() {
		// Dramatic exit animation then ask background to close
		if (GriffEl) {
			GriffEl.classList.add('Griff-swipe');
		}
		setTimeout(() => {
			chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
		}, 600);
	}

	// ─── Check if this page is blocked ───
	let checkInProgress = false;
	function checkCurrentSite() {
		if (checkInProgress) return;
		checkInProgress = true;

		const hostname = window.location.hostname;
		chrome.runtime.sendMessage({ type: 'CHECK_SITE', hostname }, (response) => {
			checkInProgress = false;
			if (chrome.runtime.lastError) return; // extension context invalidated
			if (!response) return;

			if (response.focusActive) {
				if (response.blocked) {
					// Always enforce blocked sites, even when desktop app is active
					createGriff();
					if (!isBlocked) {
						goAngry();
					}
				} else if (desktopAppActive) {
					// Desktop overlay handles the calm/idle Griff
					removeGriff();
				} else {
					createGriff();
					if (isBlocked) {
						goCalm();
					}
				}
			} else {
				removeGriff();
			}
		});
	}

	// ─── Listen for messages from background ───
	chrome.runtime.onMessage.addListener((msg) => {
		if (msg.type === 'FOCUS_STARTED') {
			checkCurrentSite();
		}
		if (msg.type === 'FOCUS_ENDED') {
			removeGriff();
		}
		if (msg.type === 'DESKTOP_APP_STATE') {
			desktopAppActive = msg.state.running && msg.state.focusActive;
			// Re-check: keeps angry Griff on blocked sites, removes calm Griff
			checkCurrentSite();
		}
	});

	// ─── LLM Integration (via background script to avoid CORS) ───
	async function getAIResponse(prompt) {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage({ type: 'LLM_ASK', prompt }, (response) => {
				if (chrome.runtime.lastError) {
					console.error('❌ AI request failed:', chrome.runtime.lastError);
					resolve(null);
					return;
				}
				if (response.error) {
					console.error('❌ AI response error:', response.error);
					resolve(null);
				} else {
					resolve(response.response);
				}
			});
		});
	}

	async function getAIStatus() {
		return new Promise((resolve) => {
			chrome.runtime.sendMessage({ type: 'LLM_INIT' }, (response) => {
				if (chrome.runtime.lastError) {
					resolve({
						availableModels: [],
						currentModel: 'None'
					});
					return;
				}
				const availableModels = response.available ? [response.modelDisplayName] : [];
				resolve({
					availableModels,
					currentModel: response.available ? response.modelDisplayName : 'None'
				});
			});
		});
	}

	// ─── Chat Interface ───
	function openChat() {
		if (window.GriffChatOpen) return;
		window.GriffChatOpen = true;

		// Create chat container from HTML string
		const chatHTML = `
			<div id="chat-container">
				<div id="chat-header">
					<div id="chat-title">
						<img src="${Griff_IMG}" alt="Griff" id="chat-icon">
						<span>Chat with Griff</span>
					</div>
					<button id="chat-close" aria-label="Close chat">×</button>
				</div>

				<div id="chat-status">
					<span id="status-indicator">🟡</span>
					<span id="status-text">Initializing LLMs...</span>
				</div>

				<div id="chat-messages"></div>

				<div id="chat-input-area">
					<input type="text" id="chat-input" placeholder="Ask Griff something..." disabled>
					<button id="chat-send" disabled>Send</button>
				</div>
			</div>
		`;

		const wrapper = document.createElement('div');
		wrapper.innerHTML = chatHTML;
		const chatContainer = wrapper.firstElementChild;
		document.body.appendChild(chatContainer);

		// Inject chat styles
		const style = document.createElement('style');
		style.textContent = getChatStyles();
		document.head.appendChild(style);

		// Set up chat event listeners
		setupChatListeners(chatContainer);

		// Request LLM status
		const chatInput = chatContainer.querySelector('#chat-input');
		const chatSend = chatContainer.querySelector('#chat-send');

		// Get and send LLM status
		getAIStatus().then((status) => {
			updateChatStatus(chatContainer, status);

			// Listen for chat messages from this chat window
			const handleMessage = (event) => {
				if (event.data.type === 'CHAT_SEND_PROMPT') {
					const prompt = event.data.prompt;

					// Show loading
					showChatLoading(chatContainer);

					// Get AI response
					getAIResponse(prompt).then((response) => {
						// Remove loading message
						const loadingMessages = chatContainer.querySelectorAll('.loading-message');
						for (const msg of loadingMessages) {
							msg.remove();
						}

						if (response) {
							// Clean up response - remove any markdown code blocks or JSON formatting
							const cleanedResponse = response
								.replace(/```json\s*/g, '')
								.replace(/```\s*/g, '')
								.trim();

							// If the response looks like JSON, don't display it
							if (cleanedResponse.startsWith('{') && cleanedResponse.endsWith('}')) {
								addChatMessage(chatContainer, "I've processed your request and updated your focus settings!", 'Griff');
							} else {
								addChatMessage(chatContainer, cleanedResponse, 'Griff');
							}
						} else {
							addChatMessage(chatContainer, 'Sorry, I had trouble thinking...', 'Griff');
						}
						chatInput.disabled = false;
						chatSend.disabled = false;
						chatInput.focus();
					});
				}
			};

			window.addEventListener('message', handleMessage);

			// Store handler for cleanup
			chatContainer.__messageHandler = handleMessage;
		});
	}

	function setupChatListeners(chatContainer) {
		const closeBtn = chatContainer.querySelector('#chat-close');
		const sendBtn = chatContainer.querySelector('#chat-send');
		const input = chatContainer.querySelector('#chat-input');

		closeBtn.addEventListener('click', () => {
			closeChat(chatContainer);
		});

		sendBtn.addEventListener('click', () => {
			sendChatMessage(chatContainer);
		});

		input.addEventListener('keypress', (e) => {
			if (e.key === 'Enter' && !input.disabled && input.value.trim()) {
				sendChatMessage(chatContainer);
			}
		});
	}

	function sendChatMessage(chatContainer) {
		const input = chatContainer.querySelector('#chat-input');
		const message = input.value.trim();

		if (!message) return;

		// Display user message
		addChatMessage(chatContainer, message, 'user');
		input.value = '';
		input.disabled = true;
		chatContainer.querySelector('#chat-send').disabled = true;

		// Send to content script via message
		window.postMessage({ type: 'CHAT_SEND_PROMPT', prompt: message }, '*');
	}

	function addChatMessage(chatContainer, text, sender) {
		const messagesDiv = chatContainer.querySelector('#chat-messages');

		const messageEl = document.createElement('div');
		messageEl.className = `chat-message ${sender}`;

		const contentEl = document.createElement('div');
		contentEl.className = `message-content ${sender}`;
		contentEl.textContent = text;

		messageEl.appendChild(contentEl);
		messagesDiv.appendChild(messageEl);

		// Scroll to bottom
		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	}

	function showChatLoading(chatContainer) {
		const messagesDiv = chatContainer.querySelector('#chat-messages');

		const messageEl = document.createElement('div');
		messageEl.className = 'chat-message Griff loading-message';

		const loadingEl = document.createElement('div');
		loadingEl.className = 'message-loading';
		loadingEl.innerHTML = '<span></span><span></span><span></span>';

		messageEl.appendChild(loadingEl);
		messagesDiv.appendChild(messageEl);

		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	}

	function updateChatStatus(chatContainer, status) {
		const statusIndicator = chatContainer.querySelector('#status-indicator');
		const statusText = chatContainer.querySelector('#status-text');
		const input = chatContainer.querySelector('#chat-input');
		const sendBtn = chatContainer.querySelector('#chat-send');
		const messagesDiv = chatContainer.querySelector('#chat-messages');

		const availableCount = status.availableModels ? status.availableModels.length : 0;

		if (availableCount === 0) {
			statusIndicator.textContent = '🔴';
			statusText.textContent = 'No LLMs available!';
			statusText.style.color = '#f44336';
			input.disabled = true;
			sendBtn.disabled = true;
		} else {
			statusIndicator.textContent = '🟢';
			statusText.textContent = `Using: ${status.currentModel}`;
			statusText.style.color = '#4caf50';
			input.disabled = false;
			sendBtn.disabled = false;

			// Add welcome message if first time
			if (messagesDiv.children.length === 0) {
				addChatMessage(chatContainer, `Hi! I'm Griff. I'm using ${status.currentModel} today. What would you like to chat about?`, 'Griff');
			}
		}
	}

	function closeChat(chatContainer) {
		if (chatContainer?.__messageHandler) {
			window.removeEventListener('message', chatContainer.__messageHandler);
		}

		if (chatContainer) {
			chatContainer.style.animation = 'chat-slide-up 0.3s ease-out reverse';
			setTimeout(() => {
				if (chatContainer?.parentNode) {
					chatContainer.parentNode.removeChild(chatContainer);
					window.GriffChatOpen = false;
				}
			}, 300);
		}
	}

	function getChatStyles() {
		return `
			@keyframes chat-slide-up {
				from { transform: translateX(100%); opacity: 0; }
				to { transform: translateX(0); opacity: 1; }
			}
			@keyframes status-pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.5; }
			}
			@keyframes message-fade-in {
				from { opacity: 0; transform: translateY(10px); }
				to { opacity: 1; transform: translateY(0); }
			}
			@keyframes loading-pulse {
				0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
				40% { opacity: 1; transform: scale(1); }
			}
			#chat-container {
				position: fixed; top: 0; right: 0; width: 380px; height: 100vh;
				background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,0.15);
				display: flex; flex-direction: column; z-index: 2147483646;
				font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
				animation: chat-slide-in 0.3s ease-out;
				border-radius: 0;
			}
			#chat-header {
				display: flex; justify-content: space-between; align-items: center;
				padding: 14px 16px; border-bottom: 1px solid #e0e0e0;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				border-radius: 0;
			}
			#chat-title {
				display: flex; align-items: center; gap: 10px; color: #fff;
				font-weight: 600; font-size: 14px;
			}
			#chat-icon {
				width: 24px; height: 24px; object-fit: contain;
			}
			#chat-close {
				background: rgba(255,255,255,0.3); border: none; color: #fff;
				font-size: 24px; cursor: pointer; width: 32px; height: 32px;
				border-radius: 6px; display: flex; align-items: center; justify-content: center;
				transition: background 0.2s; padding: 0; line-height: 1;
			}
			#chat-close:hover { background: rgba(255,255,255,0.4); }
			#chat-status {
				display: flex; align-items: center; gap: 8px; padding: 10px 16px;
				background: #f8f9fa; font-size: 12px; color: #666; border-bottom: 1px solid #e0e0e0;
			}
			#status-indicator {
				font-size: 10px; animation: status-pulse 1.5s ease-in-out infinite;
			}
			#chat-messages {
				flex: 1; overflow-y: auto; padding: 16px; display: flex;
				flex-direction: column; gap: 12px;
			}
			#chat-messages::-webkit-scrollbar { width: 6px; }
			#chat-messages::-webkit-scrollbar-track { background: transparent; }
			#chat-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
			#chat-messages::-webkit-scrollbar-thumb:hover { background: #999; }
			.chat-message {
				display: flex; gap: 8px; animation: message-fade-in 0.3s ease-out;
			}
			.chat-message.user { justify-content: flex-end; }
			.chat-message.Griff { justify-content: flex-start; }
			.message-content {
				max-width: 70%; padding: 10px 12px; border-radius: 8px;
				font-size: 13px; line-height: 1.4; word-wrap: break-word;
			}
			.message-content.user {
				background: #667eea; color: #fff; border-radius: 12px 4px 12px 12px;
			}
			.message-content.Griff {
				background: #e8e8e8; color: #333; border-radius: 4px 12px 12px 12px;
			}
			.message-loading {
				display: flex; gap: 4px; padding: 8px 12px;
			}
			.message-loading span {
				width: 6px; height: 6px; border-radius: 50%;
				background: #999; animation: loading-pulse 1.4s infinite;
			}
			.message-loading span:nth-child(1) { animation-delay: 0s; }
			.message-loading span:nth-child(2) { animation-delay: 0.2s; }
			.message-loading span:nth-child(3) { animation-delay: 0.4s; }
			#chat-input-area {
				display: flex; gap: 8px; padding: 12px 16px;
				border-top: 1px solid #e0e0e0; background: #f8f9fa;
				border-radius: 0;
			}
			#chat-input {
				flex: 1; border: 1px solid #ddd; border-radius: 6px;
				padding: 10px 12px; font-size: 13px; font-family: inherit;
				transition: border-color 0.2s;
			}
			#chat-input:focus {
				outline: none; border-color: #667eea;
				box-shadow: 0 0 0 2px rgba(102,126,234,0.1);
			}
			#chat-input:disabled { background: #eee; cursor: not-allowed; }
			#chat-send {
				background: #667eea; color: white; border: none; border-radius: 6px;
				padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
				transition: background 0.2s;
			}
			#chat-send:hover:not(:disabled) { background: #764ba2; }
			#chat-send:disabled { background: #ccc; cursor: not-allowed; }
			@media (max-width: 600px) {
				#chat-container {
					position: fixed; bottom: 0; right: 0; width: 100%; height: 100%;
					border-radius: 0; max-width: 100%;
				}
				.message-content { max-width: 85%; }
			}
		`;
	}

	// ─── Initial check ───
	// Wait for DOM to be ready before checking
	function init() {
		checkCurrentSite();

		// Re-check on visibility change (e.g. switching tabs)
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				checkCurrentSite();
			}
		});
	}

	// Start checking when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		// DOM is already ready
		init();
	}
})();
