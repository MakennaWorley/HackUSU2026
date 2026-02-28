// Default blocked sites (blacklist) – hostnames that are off-limits during focus
const DEFAULT_BLACKLIST = [
	'reddit.com',
	'www.reddit.com',
	'twitter.com',
	'x.com',
	'www.twitter.com',
	'facebook.com',
	'www.facebook.com',
	'instagram.com',
	'www.instagram.com',
	'tiktok.com',
	'www.tiktok.com',
	'youtube.com',
	'www.youtube.com',
	'netflix.com',
	'www.netflix.com',
	'twitch.tv',
	'www.twitch.tv',
	'discord.com',
	'www.discord.com',
	'9gag.com',
	'imgur.com',
	'buzzfeed.com',
	'tumblr.com',
	'pinterest.com',
	'www.pinterest.com',
	'snapchat.com',
	'www.snapchat.com'
];

// Initialise storage defaults on install
chrome.runtime.onInstalled.addListener(() => {
	chrome.storage.local.get(['blacklist', 'focusActive', 'focusEnd', 'focusDuration', 'mode'], (data) => {
		const defaults = {};
		if (!data.blacklist) defaults.blacklist = DEFAULT_BLACKLIST;
		if (data.focusActive === undefined) defaults.focusActive = false;
		if (!data.focusEnd) defaults.focusEnd = 0;
		if (!data.focusDuration) defaults.focusDuration = 25; // minutes
		if (!data.mode) defaults.mode = 'blacklist'; // "blacklist" or "whitelist"
		if (Object.keys(defaults).length) chrome.storage.local.set(defaults);
	});
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
		chrome.storage.local.get(['focusActive', 'focusEnd', 'focusDuration', 'blacklist', 'mode'], (data) => {
			// Auto-expire if time's up
			if (data.focusActive && data.focusEnd && Date.now() >= data.focusEnd) {
				stopFocus();
				sendResponse({ focusActive: false });
			} else {
				sendResponse(data);
			}
		});
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
		if (msg.blacklist) updates.blacklist = msg.blacklist;
		if (msg.mode) updates.mode = msg.mode;
		if (msg.focusDuration) updates.focusDuration = msg.focusDuration;
		chrome.storage.local.set(updates, () => sendResponse({ ok: true }));
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
