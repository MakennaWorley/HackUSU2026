// Default blocked sites (blacklist) – hostnames that are off-limits during focus
const DEFAULT_BLACKLIST = [
	'reddit.com',
	'twitter.com',
	'x.com',
	'facebook.com',
	'instagram.com',
	'tiktok.com',
	'youtube.com',
	'netflix.com',
	'twitch.tv',
	'discord.com',
	'9gag.com',
	'imgur.com',
	'buzzfeed.com',
	'tumblr.com',
	'pinterest.com',
	'snapchat.com'
];

// Default blocked categories (blacklist) – hostnames that are off-limits during focus
const DEFAULT_CATEGORIES = [
	{
		id: 'social_media',
		name: 'Social Media',
		description: 'Scrolling, posting, and social feeds',
		sites: ['reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'snapchat.com', 'tumblr.com', 'pinterest.com']
	},
	{
		id: 'video_streaming',
		name: 'Video & Streaming',
		description: 'Entertainment video platforms',
		sites: ['youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com', 'disneyplus.com', 'primevideo.com']
	},
	{
		id: 'chat_messaging',
		name: 'Chat & Messaging',
		description: 'Real-time messaging and chat apps',
		sites: ['discord.com', 'messenger.com', 'web.whatsapp.com', 'telegram.org', 'slack.com']
	},
	{
		id: 'news_media',
		name: 'News & Media',
		description: 'News, blogs, and articles',
		sites: ['buzzfeed.com', 'nytimes.com', 'cnn.com', 'theguardian.com', 'washingtonpost.com']
	},
	{
		id: 'forums',
		name: 'Forums & Communities',
		description: 'Discussion boards and community sites',
		sites: ['reddit.com', 'stackexchange.com', 'quora.com']
	},
	{
		id: 'shopping',
		name: 'Shopping',
		description: 'Online stores and marketplaces',
		sites: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'target.com']
	},
	{
		id: 'gaming',
		name: 'Gaming',
		description: 'Browser-based games and gaming platforms',
		sites: ['steamcommunity.com', 'crazygames.com', 'poki.com']
	},
	{
		id: 'image_browsing',
		name: 'Image Browsing',
		description: 'Image-heavy browsing and meme sites',
		sites: ['imgur.com', '9gag.com']
	}
];

// Helper to build the complete blocklist from categories and custom sites
function buildBlocklist(selectedCategories, customSites, customCategories = []) {
	const siteSet = new Set();

	// Add sites from selected default categories
	for (const categoryId of selectedCategories) {
		const category = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
		if (category) {
			for (const site of category.sites) {
				siteSet.add(site);
			}
		}
	}

	// Add sites from selected custom categories
	for (const categoryId of selectedCategories) {
		const category = customCategories.find((c) => c.id === categoryId);
		if (category) {
			for (const site of category.sites) {
				siteSet.add(site);
			}
		}
	}

	// Add custom sites
	for (const site of customSites) {
		siteSet.add(site);
	}

	return Array.from(siteSet);
}

// Initialise storage defaults on install
chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get(
		[
			'blacklist',
			'customSites',
			'selectedCategories',
			'customCategories',
			'deletedDefaultCategories',
			'focusActive',
			'focusEnd',
			'focusDuration',
			'mode'
		],
		(data) => {
			const defaults = {};
			// Migrate old blacklist to new system if needed
			if (!data.customSites && data.blacklist) {
				defaults.customSites = data.blacklist;
				defaults.selectedCategories = [];
			} else if (!data.customSites) {
				defaults.customSites = [];
			}
			if (!data.selectedCategories) defaults.selectedCategories = [];
			if (!data.customCategories) defaults.customCategories = [];
			if (!data.deletedDefaultCategories) defaults.deletedDefaultCategories = [];
			if (data.focusActive === undefined) defaults.focusActive = false;
			if (!data.focusEnd) defaults.focusEnd = 0;
			if (!data.focusDuration) defaults.focusDuration = 25; // minutes
			if (!data.mode) defaults.mode = 'blacklist'; // "blacklist" or "whitelist"

			// Build the blacklist from categories and custom sites
			if (defaults.selectedCategories || defaults.customSites) {
				defaults.blacklist = buildBlocklist(
					defaults.selectedCategories || data.selectedCategories || [],
					defaults.customSites || data.customSites || [],
					data.customCategories || []
				);
			} else if (!data.blacklist) {
				defaults.blacklist = DEFAULT_BLACKLIST;
			}

			if (Object.keys(defaults).length) chrome.storage.local.set(defaults);
		}
	);
});

// ─── LLM Manager (runs in background to avoid CORS) ───
const LLM_CONFIG = {
	phi: {
		name: 'Phi Mini',
		type: 'ollama',
		endpoint: 'http://localhost:11434/api/generate',
		available: false,
		modelName: null
		// systemPrompt: `You are Griff, a friendly griffin helping users stay focused. You speak in first person (I, me, my), never third person.

		// 	There are TWO types of messages:

		// 	1. FOCUS REQUEST (user asks for help with a task/goal) - Respond with JSON:
		// 	{
		// 	"intent": "what the user wants to focus on or asking for help blocking sites",
		// 	"suggestions": ["youtube.com", "reddit.com", "instagram.com"],
		// 	"message": "A short encouraging message"
		// 	}

		// 	Examples of FOCUS REQUESTS:
		// 	- "Help me focus on coding"
		// 	- "I need to study for my exam"
		// 	- "I want to write my novel"

		// 	Rules for FOCUS REQUESTS:
		// 	- Only suggest 3-5 popular distracting websites relevant to their task
		// 	- Common distractions: youtube.com, reddit.com, instagram.com, twitter.com, facebook.com, tiktok.com, netflix.com
		// 	- Keep the message short and encouraging
		// 	- Output ONLY the JSON, no other text
		// 	- Do not mention Pomodoro

		// 	2. CASUAL CHAT (everything else) - Respond with plain text, NO JSON:

		// 	Examples of CASUAL CHAT:
		// 	- "thanks", "thank you", "thanks griff"
		// 	- "how are you?"
		// 	- General questions or conversation

		// 	Rules for CASUAL CHAT:
		// 	- Respond naturally in plain text (NO JSON format)
		// 	- Keep it very brief: 1-2 short sentences
		// 	- Use first person (I, me) never third person (Griff)
		// 	- Do NOT mention blocking websites or adding sites

		// 	Rules for FOCUS REQUESTS (JSON only):
		// 	- Suggest 3-5 distracting websites: youtube.com, reddit.com, instagram.com, twitter.com, facebook.com, tiktok.com, netflix.com
		// 	- Output ONLY the JSON, nothing else
		// 	- Do not mention Pomodoro`
	}
};

const FOCUS_SYSTEM = `
	You are Griff, a friendly griffin helping users stay focused.
	You speak in first person (I, me, my), never third person. Do NOT address yourself as Griff.

	This is a FOCUS REQUEST. Respond with JSON ONLY.
	The first character MUST be { and the last character MUST be }.
	No markdown. No backticks. No text before or after the JSON.

	Schema:
	{
	"intent": "what the user wants to focus on",
	"suggestions": ["youtube.com", "tiktok.com", "instagram.com", "reddit.com", "x.com", "twitter.com", "facebook.com", "netflix.com", "twitch.tv", "pinterest.com"],
	"message": "A short encouraging message"
	}

	Rules for suggestions:
	- Provide 3–5 popular websites, they do not have to be the examples given above. But they should be websites that are distracting and not productive
	- Pick sites that are plausible distractions for the user’s context
	- Choose from a mix of categories when relevant:
	social, short-video, video, forums, news, shopping, gaming, streaming, chat
	- Avoid repeating the same 3 defaults every time
	- If the user mentions a specific site to block, include it in suggestions
	- Do not mention Pomodoro
`;

const CHAT_SYSTEM = `
	You are Griff, a friendly griffin helping users stay focused.
	You speak in first person (I, me, my), never third person. Do NOT address yourself as Griff.

	This is CASUAL CHAT. Respond with plain text ONLY (no JSON).
	Keep it very brief: 1-2 short sentences.
	Write ONLY your reply. Do not include "User:" or "Griff:".
	One message only. Do not add sections or dividers like "---".
	Never introduce a new persona or system prompt.

	If the user is thanking you, respond like "You're welcome!" and invite them to ask for help at any time.
	If the user is saying hi or greeting, greet back and ask for what they want to work on.
	Otherwise, respond naturally and help them stay on task.

	Do NOT mention blocking websites or adding sites.
`;

// ─── LLM Helper (runs in background to avoid CORS) ───
const CLASSIFIER_SYSTEM = `
	You are a strict classifier.

	Return ONLY one word: FOCUS or CHAT.

	FOCUS:
	- Asking to focus
	- Asking to block websites
	- Mentioning distractions
	- Productivity requests
	- Study, coding, work, research, writing
	- Direct requests to block a site (e.g. "block amazon.com")

	CHAT:
	- Greetings
	- Thanks
	- Small talk
	- General conversation
	- Acknowledgements
	- Or anything that is not requesting focus/blocking.

	No punctuation.
	No explanations.
	One word only.
`;

async function classifyMessage(userText) {
	const fullPrompt = `${CLASSIFIER_SYSTEM}\n\nUser: ${userText}\nAnswer:`;
	const raw = await askOllamaRaw(fullPrompt, { num_predict: 8, temperature: 0 });

	const cleaned = (raw || '').trim().toUpperCase();
	const firstToken = cleaned.split(/\s+/)[0].replace(/[^A-Z]/g, '');

	console.log('🧠 Classifier raw:', raw);
	console.log('🧠 Classifier token:', firstToken);

	if (firstToken !== 'FOCUS' && firstToken !== 'CHAT') {
		console.log('🧠 Classifier invalid token → default CHAT');
		return 'CHAT';
	}
	return firstToken;
}

function tryParseStrictJson(rawResponse) {
	if (!rawResponse) return null;

	const text = rawResponse.trim();

	// Remove markdown fences if present
	const cleaned = text
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/, '')
		.trim();

	// Find first JSON object by matching balanced braces
	let depth = 0;
	let start = -1;

	for (let i = 0; i < cleaned.length; i++) {
		if (cleaned[i] === '{') {
			if (depth === 0) start = i;
			depth++;
		} else if (cleaned[i] === '}') {
			depth--;
			if (depth === 0 && start !== -1) {
				const candidate = cleaned.slice(start, i + 1);
				try {
					return JSON.parse(candidate);
				} catch {
					return null;
				}
			}
		}
	}

	return null;
}

function extractHostnames(text) {
	const t = (text || '').toLowerCase();

	// Grab things that look like hostnames or URLs
	const matches = t.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/g) || [];

	// Normalize into hostnames
	const hostnames = matches
		.map(
			(m) =>
				m
					.replace(/^https?:\/\//, '')
					.replace(/^www\./, '')
					.split('/')[0]
		)
		.filter(Boolean);

	// De-dupe
	return Array.from(new Set(hostnames));
}

function resolveBareSiteWord(word) {
	const w = (word || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-]/g, '');
	if (!w) return null;

	// Build a set of known sites from your defaults (and categories)
	const known = new Set(DEFAULT_BLACKLIST);
	for (const cat of DEFAULT_CATEGORIES) {
		for (const s of cat.sites) known.add(s);
	}

	// If user typed "youtube", match "youtube.com" from known
	for (const site of known) {
		const base = site.split('.')[0]; // youtube from youtube.com
		if (base === w) return site;
	}

	return null;
}

function extractBareSiteWord(text) {
	const t = (text || '').toLowerCase();

	// Look for "block X" / "unblock X" / "remove X"
	const m = t.match(/\b(block|unblock|remove|allow|delete|ban|blacklist|whitelist)\s+([a-z0-9-]{2,30})\b/);
	if (!m) return null;

	return m[2]; // the word after the verb
}

function detectDirectAction(text) {
	const t = (text || '').toLowerCase();

	// remove/unblock/allow
	if (/\b(remove|unblock|allow|whitelist|stop blocking|delete)\b/.test(t)) return 'remove';

	// add/block
	if (/\b(block|add|ban|blacklist)\b/.test(t)) return 'add';

	return null;
}

async function respondToUser(userText) {
	const action = detectDirectAction(userText);

	// 1) normal hostnames (amazon.com etc.)
	let explicitSites = extractHostnames(userText);

	// 2) bare words (youtube) -> resolve to known sites (youtube.com)
	if (explicitSites.length === 0 && action) {
		const bare = extractBareSiteWord(userText);
		const resolved = resolveBareSiteWord(bare);
		if (resolved) explicitSites = [resolved];
	}

	if (explicitSites.length > 0 && action) {
		return {
			type: 'focus',
			json: {
				action,
				intent: action === 'remove' ? 'remove specific sites' : 'block specific sites',
				suggestions: explicitSites.slice(0, 5),
				message:
					action === 'remove' ? 'Got it — I’ll remove those from your blocked site(s).' : 'Got it — I’ll add those to your blocked site(s).'
			}
		};
	}

	const mode = await classifyMessage(userText);

	if (mode === 'CHAT') {
		const raw = await askOllamaRaw(`${CHAT_SYSTEM}\n\nUser: ${userText}\nGriff:`, {
			temperature: 0.7,
			num_predict: 80,
			stop: [
				'\nUser:',
				'\nGriff:',
				'\n\nUser:',
				'\n\nGriff:',
				'\n---',
				'\n\n---',
				'\nYou are',
				'\n\nYou are',
				'\nYou’re',
				'\n\nYou’re',
				'\n\n\tYou are',
				'\n\tYou are'
			]
		});
		let text = (raw || '').trim();
		text = text.split('\n---')[0].split('\n\n---')[0];
		text = text.split('\nYou are')[0].split('\n\nYou are')[0];
		return { type: 'chat', text: text.trim() };
	}

	// mode === "FOCUS"
	const raw = await askOllamaRaw(`${FOCUS_SYSTEM}\n\nUser: ${userText}`, {
		temperature: 0.4,
		stop: [
			'\nUser:',
			'\nGriff:',
			'\n\nUser:',
			'\n\nGriff:',
			'\n---',
			'\n\n---',
			'\nYou are',
			'\n\nYou are',
			'\nYou’re',
			'\n\nYou’re',
			'\n\n\tYou are',
			'\n\tYou are'
		],
		num_predict: 200
	});
	const parsed = tryParseStrictJson(raw);
	if (!parsed) {
		let text = (raw || '').trim();
		text = text.split('\n---')[0].split('\n\n---')[0];
		text = text.split('\nYou are')[0].split('\n\nYou are')[0];
		return { type: 'chat', text: text.trim() };
	}
	return { type: 'focus', json: parsed };
}

async function askOllamaRaw(fullPrompt, options = {}) {
	const modelName = LLM_CONFIG.phi.modelName || 'phi3:mini';
	const response = await fetch(LLM_CONFIG.phi.endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: modelName,
			prompt: fullPrompt,
			stream: false,
			options
		})
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const data = await response.json();
	return data.response;
}

let llmInitialized = false;

async function detectOllama() {
	try {
		// First, try to get list of available models
		const listResponse = await fetch('http://localhost:11434/api/tags', {
			method: 'GET',
			signal: AbortSignal.timeout(10000)
		});

		if (listResponse.ok) {
			const data = await listResponse.json();

			// Try different phi model names
			const phiModels = ['phi-mini', 'phi3:mini', 'phi', 'phi-mini:latest'];
			let foundModel = null;

			// Check which model is available
			for (const modelName of phiModels) {
				if (data.models?.some((m) => m.name === modelName)) {
					foundModel = modelName;
					break;
				}
			}

			if (foundModel) {
				LLM_CONFIG.phi.modelName = foundModel;
				LLM_CONFIG.phi.available = true;
				console.log('✅ Ollama detected with model:', foundModel);
				return true;
			}
		}

		// Fallback: try a test call with different model names
		const modelNames = ['phi-mini', 'phi3:mini', 'phi', 'neural-chat'];

		for (const modelName of modelNames) {
			try {
				const testResponse = await fetch(LLM_CONFIG.phi.endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: modelName,
						prompt: 'test',
						stream: false
					}),
					signal: AbortSignal.timeout(30000)
				});

				if (testResponse.ok) {
					LLM_CONFIG.phi.modelName = modelName;
					LLM_CONFIG.phi.available = true;
					console.log('✅ Ollama detected with model:', modelName);
					return true;
				}
			} catch {}
		}
	} catch (error) {
		console.log('❌ Ollama not detected:', error.message);
	}
	return false;
}

async function askOllama(prompt) {
	try {
		const modelName = LLM_CONFIG.phi.modelName || 'phi3:mini';
		const fullPrompt = `${LLM_CONFIG.phi.systemPrompt}\n\nUser: ${prompt}`;

		const response = await fetch(LLM_CONFIG.phi.endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: modelName,
				prompt: fullPrompt,
				stream: false
			})
		});

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const data = await response.json();
		return data.response;
	} catch (error) {
		console.error('❌ Ollama request failed:', error);
		throw error;
	}
}

// Initialize LLM on startup
detectOllama().then((success) => {
	llmInitialized = true;
	if (success) {
		console.log('🦅 Griff is ready to chat!');
	}
});

// ─── Message handling from popup & content scripts ───
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.type === 'START_FOCUS') {
		const minutes = msg.duration || 25;
		const end = Date.now() + minutes * 60 * 1000;
		chrome.storage.local.set({ focusActive: true, focusEnd: end, focusDuration: minutes }, () => {
			// Create an alarm so we can auto-stop when time's up
			chrome.alarms.create('focusEnd', { when: end });
			sendResponse({ ok: true, end });
			// Notify every open tab that focus started
			broadcastToTabs({ type: 'FOCUS_STARTED', end });
		});
		return true; // keep channel open for async sendResponse
	}

	if (msg.type === 'STOP_FOCUS') {
		stopFocus();
		sendResponse({ ok: true });
		return true;
	}

	if (msg.type === 'GET_STATUS') {
		chrome.storage.local.get(
			[
				'focusActive',
				'focusEnd',
				'focusDuration',
				'blacklist',
				'mode',
				'customSites',
				'selectedCategories',
				'customCategories',
				'deletedDefaultCategories'
			],
			(data) => {
				// Auto-expire if time's up
				if (data.focusActive && data.focusEnd && Date.now() >= data.focusEnd) {
					stopFocus();
					sendResponse({ focusActive: false });
				} else {
					const deletedDefaultCategories = data.deletedDefaultCategories || [];
					// Filter out deleted default categories
					const activeDefaultCategories = DEFAULT_CATEGORIES.filter((c) => !deletedDefaultCategories.includes(c.id));
					// Combine active default and custom categories
					const allCategories = [...activeDefaultCategories, ...(data.customCategories || [])];
					// Include categories in response
					sendResponse({
						...data,
						categories: allCategories,
						customSites: data.customSites || [],
						selectedCategories: data.selectedCategories || []
					});
				}
			}
		);
		return true;
	}

	if (msg.type === 'CHECK_SITE') {
		chrome.storage.local.get(['focusActive', 'focusEnd', 'blacklist', 'mode'], (data) => {
			// Focus is active if either the extension OR the desktop app started it
			const extensionFocusActive = data.focusActive && (!data.focusEnd || Date.now() < data.focusEnd);
			const effectiveFocusActive = extensionFocusActive || (desktopAppState.running && desktopAppState.focusActive);

			if (!effectiveFocusActive) {
				sendResponse({ blocked: false, focusActive: false });
				return;
			}
			if (extensionFocusActive && data.focusEnd && Date.now() >= data.focusEnd) {
				stopFocus();
				sendResponse({ blocked: false, focusActive: false });
				return;
			}
			const hostname = msg.hostname || '';
			const list = data.blacklist || DEFAULT_BLACKLIST;
			const mode = data.mode || 'blacklist';
			let blocked = false;
			if (mode === 'blacklist') {
				blocked = list.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
			} else {
				// whitelist mode – block everything NOT in the list
				blocked = !list.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
			}
			sendResponse({ blocked, focusActive: true, end: data.focusEnd });
		});
		return true;
	}

	if (msg.type === 'GET_DESKTOP_STATE') {
		sendResponse(desktopAppState);
		return true;
	}

	if (msg.type === 'CLOSE_TAB') {
		if (sender.tab?.id) {
			chrome.tabs.remove(sender.tab.id);
		}
		sendResponse({ ok: true });
		return true;
	}

	if (msg.type === 'SAVE_SETTINGS') {
		// Handle save from popup - data is at root level
		const customSites = msg.customSites || [];
		const selectedCategories = msg.selectedCategories || [];
		const mode = msg.mode;
		const focusDuration = msg.focusDuration;

		chrome.storage.local.get(['customCategories'], (data) => {
			const customCategories = data.customCategories || [];
			const blacklist = buildBlocklist(selectedCategories, customSites, customCategories);

			const updates = {
				customSites,
				selectedCategories,
				blacklist,
				mode,
				focusDuration
			};

			chrome.storage.local.set(updates, () => sendResponse({ ok: true }));
		});

		return true;
	}

	if (msg.type === 'UPDATE_SETTINGS') {
		const updates = msg.updates || {};

		// Rebuild the blacklist from selected categories and custom sites
		chrome.storage.local.get(['customSites', 'selectedCategories', 'customCategories'], (data) => {
			const customSites = updates.customSites !== undefined ? updates.customSites : data.customSites || [];
			const selectedCategories = updates.selectedCategories !== undefined ? updates.selectedCategories : data.selectedCategories || [];
			const customCategories = data.customCategories || [];

			updates.blacklist = buildBlocklist(selectedCategories, customSites, customCategories);

			chrome.storage.local.set(updates, () => sendResponse({ ok: true }));
		});

		return true;
	}

	if (msg.type === 'ADD_CATEGORY') {
		if (!msg.category) {
			sendResponse({ ok: false, error: 'No category provided' });
			return;
		}

		chrome.storage.local.get(['customCategories', 'selectedCategories'], (data) => {
			const customCategories = data.customCategories || [];
			const selectedCategories = data.selectedCategories || [];

			// Check if category ID already exists
			const exists = customCategories.some((c) => c.id === msg.category.id) || DEFAULT_CATEGORIES.some((c) => c.id === msg.category.id);

			if (exists) {
				sendResponse({ ok: false, error: 'Category with this name already exists' });
				return;
			}

			// Add the new category
			customCategories.push(msg.category);

			// Auto-select the new category
			selectedCategories.push(msg.category.id);

			// Rebuild blacklist
			chrome.storage.local.get(['customSites'], (data2) => {
				const blacklist = buildBlocklist(selectedCategories, data2.customSites || [], customCategories);
				chrome.storage.local.set(
					{
						customCategories,
						selectedCategories,
						blacklist
					},
					() => {
						sendResponse({ ok: true });
					}
				);
			});
		});

		return true;
	}

	if (msg.type === 'DELETE_CATEGORY') {
		if (!msg.categoryId) {
			sendResponse({ ok: false, error: 'No category ID provided' });
			return;
		}

		chrome.storage.local.get(['customCategories', 'selectedCategories', 'deletedDefaultCategories'], (data) => {
			const updates = {};

			if (msg.isCustom) {
				// Delete custom category
				updates.customCategories = (data.customCategories || []).filter((c) => c.id !== msg.categoryId);
			} else {
				// Mark default category as deleted
				const deletedDefaultCategories = data.deletedDefaultCategories || [];
				if (!deletedDefaultCategories.includes(msg.categoryId)) {
					deletedDefaultCategories.push(msg.categoryId);
				}
				updates.deletedDefaultCategories = deletedDefaultCategories;
				updates.customCategories = data.customCategories || [];
			}

			// Remove from selected categories
			updates.selectedCategories = (data.selectedCategories || []).filter((id) => id !== msg.categoryId);

			// Rebuild blacklist
			chrome.storage.local.get(['customSites'], (data2) => {
				const blacklist = buildBlocklist(updates.selectedCategories, data2.customSites || [], updates.customCategories);
				updates.blacklist = blacklist;
				chrome.storage.local.set(updates, () => {
					sendResponse({ ok: true });
				});
			});
		});

		return true;
	}

	if (msg.type === 'RESET_TO_DEFAULTS') {
		// Reset everything to defaults
		const defaults = {
			customSites: [...DEFAULT_BLACKLIST],
			customCategories: [],
			deletedDefaultCategories: [],
			selectedCategories: [],
			mode: 'blacklist',
			focusDuration: 25
		};

		// Build the default blacklist
		defaults.blacklist = buildBlocklist(defaults.selectedCategories, defaults.customSites, defaults.customCategories);

		chrome.storage.local.set(defaults, () => {
			sendResponse({ ok: true });
		});

		return true;
	}

	// ─── LLM Message Handlers ───
	if (msg.type === 'LLM_INIT') {
		if (!llmInitialized) {
			detectOllama().then(() => {
				llmInitialized = true;
				sendResponse({
					available: LLM_CONFIG.phi.available,
					modelName: LLM_CONFIG.phi.modelName,
					modelDisplayName: LLM_CONFIG.phi.name
				});
			});
		} else {
			sendResponse({
				available: LLM_CONFIG.phi.available,
				modelName: LLM_CONFIG.phi.modelName,
				modelDisplayName: LLM_CONFIG.phi.name
			});
		}
		return true;
	}

	if (msg.type === 'LLM_ASK') {
		if (!LLM_CONFIG.phi.available) {
			sendResponse({ error: 'Ollama is not running.' });
			return true;
		}

		console.log('🦅 LLM_ASK prompt:', msg.prompt);

		respondToUser(msg.prompt)
			.then((result) => {
				if (result.type === 'chat') {
					console.log('🗨️ CHAT response:', result.text);
					sendResponse({ response: result.text });
					return;
				}

				// Focus result
				const parsed = result.json;
				const action = (parsed.action || 'add').toLowerCase();
				console.log('🎯 FOCUS parsed JSON:', parsed, 'action=', action);

				chrome.storage.local.get(['customSites', 'selectedCategories', 'customCategories'], (data) => {
					const currentCustomSites = data.customSites || [];
					const selectedCategories = data.selectedCategories || [];
					const customCategories = data.customCategories || [];

					// Normalize suggestions
					const suggestions = Array.isArray(parsed.suggestions)
						? parsed.suggestions.map((s) => String(s).toLowerCase().trim()).filter(Boolean)
						: [];

					// ✅ REMOVE path
					if (action === 'remove') {
						const removedSites = suggestions.filter((site) => currentCustomSites.includes(site));
						const updatedCustomSites = currentCustomSites.filter((site) => !removedSites.includes(site));
						const updatedBlacklist = buildBlocklist(selectedCategories, updatedCustomSites, customCategories);

						chrome.storage.local.set({ customSites: updatedCustomSites, blacklist: updatedBlacklist });

						if (removedSites.length > 0) {
							console.log('🗑️ Removed sites:', removedSites);
							sendResponse({
								response: `${parsed.message || 'Done!'}\n\nI removed: ${removedSites.join(', ')}`,
								removedSites
							});
						} else {
							console.log('ℹ️ No sites to remove');
							sendResponse({
								response: `${parsed.message || 'Okay!'}\n\nNone of those sites were blocked.`,
								removedSites: []
							});
						}
						return;
					}

					// ✅ ADD path (default)
					const newSites = suggestions.filter((site) => !currentCustomSites.includes(site));

					if (newSites.length > 0) {
						const updatedCustomSites = [...currentCustomSites, ...newSites];
						const updatedBlacklist = buildBlocklist(selectedCategories, updatedCustomSites, customCategories);

						chrome.storage.local.set({ customSites: updatedCustomSites, blacklist: updatedBlacklist });

						console.log('✅ Added sites:', newSites);

						const siteList = newSites.join(', ');
						const customMessage =
							`${parsed.message || "I've updated your blocked sites!"}\n\n` + `I added these sites to help you focus: ${siteList}`;

						sendResponse({ response: customMessage, addedSites: newSites });
					} else {
						console.log('ℹ️ No new sites to add');
						sendResponse({
							response: `${parsed.message || 'Great!'} (You already have all these sites blocked!)`,
							addedSites: []
						});
					}
				});
			})
			.catch((error) => {
				console.error('❌ Ollama request error:', error);
				sendResponse({ error: error.message });
			});

		return true;
	}
});

// ─── Alarm listener to auto-stop focus ───
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === 'focusEnd') {
		stopFocus();
	}
});

// ─── Helpers ───
function stopFocus() {
	chrome.storage.local.set({ focusActive: false, focusEnd: 0 });
	chrome.alarms.clear('focusEnd');
	broadcastToTabs({ type: 'FOCUS_ENDED' });
}

async function broadcastToTabs(message) {
	try {
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			if (!tab.id || !tab.url) continue;
			// Skip chrome:// and other protected URLs
			if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
				continue;
			}
			try {
				// Send message to content script
				await chrome.tabs.sendMessage(tab.id, message);
			} catch {
				// Content script might not be injected yet, try to inject it
				try {
					await chrome.scripting.executeScript({
						target: { tabId: tab.id },
						files: ['content.js']
					});
					// Retry sending message after injection
					await chrome.tabs.sendMessage(tab.id, message);
				} catch {
					// Silently fail for tabs that can't be injected
				}
			}
		}
	} catch (err) {
		console.error('Error broadcasting to tabs:', err);
	}
}

// ─── Desktop App Integration ───
let desktopAppState = { running: false, focusActive: false };
const DESKTOP_APP_URL = 'http://localhost:52525';

async function pingDesktopApp() {
	try {
		const res = await fetch(`${DESKTOP_APP_URL}/status`, { signal: AbortSignal.timeout(2000) });
		if (res.ok) {
			desktopAppState = await res.json();
		} else {
			desktopAppState = { running: false, focusActive: false };
		}
	} catch {
		desktopAppState = { running: false, focusActive: false };
	}
	broadcastToTabs({ type: 'DESKTOP_APP_STATE', state: desktopAppState });
}

// Poll every 5 seconds
setInterval(pingDesktopApp, 5000);
pingDesktopApp();

// ─── Tab Activation Listener ───
// When user switches to a tab, ensure Griff appears if focus is active
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	try {
		const tab = await chrome.tabs.get(activeInfo.tabId);
		if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
			return;
		}

		// Check if focus is active
		const data = await chrome.storage.local.get(['focusActive', 'focusEnd']);
		if (data.focusActive && (!data.focusEnd || Date.now() < data.focusEnd)) {
			// Focus is active, notify this tab
			try {
				await chrome.tabs.sendMessage(activeInfo.tabId, { type: 'FOCUS_STARTED', end: data.focusEnd });
			} catch {
				// Content script not loaded, inject it
				try {
					await chrome.scripting.executeScript({
						target: { tabId: activeInfo.tabId },
						files: ['content.js']
					});
					await chrome.scripting.insertCSS({
						target: { tabId: activeInfo.tabId },
						files: ['content.css']
					});
					// Wait a moment for script to initialize, then send message
					setTimeout(async () => {
						try {
							await chrome.tabs.sendMessage(activeInfo.tabId, { type: 'FOCUS_STARTED', end: data.focusEnd });
						} catch {
							// Still failed, ignore
						}
					}, 100);
				} catch {
					// Can't inject, ignore
				}
			}
		}
	} catch {
		// Tab no longer exists or other error
	}
});

// ─── Tab Update Listener ───
// When a tab finishes loading, check if focus is active
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status !== 'complete') return;
	if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
		return;
	}

	// Check if focus is active
	const data = await chrome.storage.local.get(['focusActive', 'focusEnd']);
	if (data.focusActive && (!data.focusEnd || Date.now() < data.focusEnd)) {
		// Focus is active, notify this tab
		try {
			await chrome.tabs.sendMessage(tabId, { type: 'FOCUS_STARTED', end: data.focusEnd });
		} catch {
			// Content script might not be ready yet, it will check on init
		}
	}
});
