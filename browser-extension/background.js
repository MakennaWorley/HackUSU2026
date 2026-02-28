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
		['blacklist', 'customSites', 'selectedCategories', 'customCategories', 'focusActive', 'focusEnd', 'focusDuration', 'mode'],
		(data) => {
			const defaults = {};
			// Migrate old blacklist to new system if needed
			if (!data.customSites && data.blacklist) {
				defaults.customSites = data.blacklist;
				defaults.selectedCategories = [];
			} else if (!data.customSites) {
				defaults.customSites = [];
			}
			if (!data.selectedCategories) defaults.selectedCategories = ['social_media', 'video_streaming'];
			if (!data.customCategories) defaults.customCategories = [];
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
			['focusActive', 'focusEnd', 'focusDuration', 'blacklist', 'mode', 'customSites', 'selectedCategories', 'customCategories'],
			(data) => {
				// Auto-expire if time's up
				if (data.focusActive && data.focusEnd && Date.now() >= data.focusEnd) {
					stopFocus();
					sendResponse({ focusActive: false });
				} else {
					// Combine default and custom categories
					const allCategories = [...DEFAULT_CATEGORIES, ...(data.customCategories || [])];
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
			if (!data.focusActive) {
				sendResponse({ blocked: false, focusActive: false });
				return;
			}
			if (data.focusEnd && Date.now() >= data.focusEnd) {
				stopFocus();
				sendResponse({ blocked: false, focusActive: false });
				return;
			}
			const hostname = msg.hostname || '';
			const list = data.blacklist || DEFAULT_BLACKLIST;
			const mode = data.mode || 'blacklist';
			let blocked = false;
			if (mode === 'blacklist') {
				blocked = list.some((entry) => hostname === entry || hostname.endsWith('.' + entry));
			} else {
				// whitelist mode – block everything NOT in the list
				blocked = !list.some((entry) => hostname === entry || hostname.endsWith('.' + entry));
			}
			sendResponse({ blocked, focusActive: true, end: data.focusEnd });
		});
		return true;
	}

	if (msg.type === 'CLOSE_TAB') {
		if (sender.tab && sender.tab.id) {
			chrome.tabs.remove(sender.tab.id);
		}
		sendResponse({ ok: true });
		return true;
	}

	if (msg.type === 'SAVE_SETTINGS') {
		const updates = {};
		if (msg.customSites !== undefined) updates.customSites = msg.customSites;
		if (msg.selectedCategories !== undefined) updates.selectedCategories = msg.selectedCategories;
		if (msg.mode) updates.mode = msg.mode;
		if (msg.focusDuration) updates.focusDuration = msg.focusDuration;

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

		chrome.storage.local.get(['customCategories', 'selectedCategories'], (data) => {
			const customCategories = (data.customCategories || []).filter((c) => c.id !== msg.categoryId);
			const selectedCategories = (data.selectedCategories || []).filter((id) => id !== msg.categoryId);

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

function broadcastToTabs(message) {
	chrome.tabs.query({}, (tabs) => {
		for (const tab of tabs) {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, message).catch(() => {
					/* tab may not have content script */
				});
			}
		}
	});
}
