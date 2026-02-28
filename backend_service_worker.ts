const DEFAULT_STATE = {
	focusOn: false,
	endsAt: null, // ms timestamp
	blacklist: ['youtube.com', 'reddit.com', 'x.com', 'twitter.com']
};

async function getState() {
	const data = await chrome.storage.local.get(DEFAULT_STATE);
	return { ...DEFAULT_STATE, ...data };
}

function hostnameFromUrl(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function isBlocked(hostname, blacklist) {
	return blacklist.some((d) => hostname === d || hostname.endsWith('.' + d));
}

async function enforceOnTab(tabId, url) {
	const state = await getState();

	if (!state.focusOn) return;

	// auto turn off if timer ended
	if (state.endsAt && Date.now() > state.endsAt) {
		await chrome.storage.local.set({ focusOn: false, endsAt: null });
		return;
	}

	const host = hostnameFromUrl(url);
	if (!host) return;

	if (isBlocked(host, state.blacklist)) {
		// redirect to blocked page (cleaner demo than closing)
		const blockedUrl = chrome.runtime.getURL('blocked.html');
		chrome.tabs.update(tabId, { url: blockedUrl });
	}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.url) {
		enforceOnTab(tabId, changeInfo.url);
	}
});

// Also catch when switching to a tab that was already loaded
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
	const tab = await chrome.tabs.get(tabId);
	if (tab?.url) enforceOnTab(tabId, tab.url);
});

// Optional: alarm to flip focus mode off
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name === 'focusEnds') {
		await chrome.storage.local.set({ focusOn: false, endsAt: null });
	}
});
