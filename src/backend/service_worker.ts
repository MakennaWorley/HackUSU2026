import { DEFAULT_STATE, type FocusState } from '../shared/state';

console.log('SERVICE WORKER STARTED', new Date().toISOString());

// -------------------- Helpers --------------------
async function getState(): Promise<FocusState> {
	const data = (await chrome.storage.local.get(DEFAULT_STATE)) as Partial<FocusState>;
	return { ...DEFAULT_STATE, ...data };
}

function hostnameFromUrl(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function isBlocked(hostname: string, blacklist: string[]): boolean {
	return blacklist.some((d) => hostname === d || hostname.endsWith('.' + d));
}

async function enforceOnTab(tabId: number, url: string): Promise<void> {
	const state = await getState();

	if (!state.focusOn) return;

	// auto turn off if timer ended
	if (state.endsAt !== null && Date.now() > state.endsAt) {
		await chrome.storage.local.set({ focusOn: false, endsAt: null });
		return;
	}

	const host = hostnameFromUrl(url);
	if (!host) return;

	if (isBlocked(host, state.blacklist)) {
		// redirect to blocked page (cleaner demo than closing)
		const blockedUrl = chrome.runtime.getURL('dist/frontend/blocked.html');
		await chrome.tabs.update(tabId, { url: blockedUrl });
	}
}

// -------------------- Listeners --------------------
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (typeof changeInfo.url === 'string') {
		console.log('griff onUpdated');
		void enforceOnTab(tabId, changeInfo.url);
	}
});

// Also catch when switching to a tab that was already loaded
chrome.tabs.onActivated.addListener(({ tabId }) => {
	void (async () => {
		const tab = await chrome.tabs.get(tabId);
		const url = tab.url;
		if (typeof url === 'string') {
			console.log('griff onActivated');
			await enforceOnTab(tabId, url);
		}
	})();
});

// Optional: alarm to flip focus mode off
chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === 'focusEnds') {
		console.log('griff onAlarm');
		void chrome.storage.local.set({ focusOn: false, endsAt: null });
	}
});
