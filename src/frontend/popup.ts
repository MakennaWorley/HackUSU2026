const DEFAULT_STATE = {
	focusOn: false,
	endsAt: null,
	blacklist: ['youtube.com', 'reddit.com', 'x.com', 'twitter.com']
};

function fmtRemaining(ms) {
	const s = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${String(r).padStart(2, '0')}`;
}

async function loadState() {
	const state = await chrome.storage.local.get(DEFAULT_STATE);
	return { ...DEFAULT_STATE, ...state };
}

async function render() {
	const state = await loadState();
	document.getElementById('blacklist').value = state.blacklist.join(', ');
	const btn = document.getElementById('toggle');
	const status = document.getElementById('status');

	if (state.focusOn && state.endsAt) {
		btn.textContent = 'Stop Focus';
		status.textContent = `Focus ON — remaining ${fmtRemaining(state.endsAt - Date.now())}`;
	} else if (state.focusOn) {
		btn.textContent = 'Stop Focus';
		status.textContent = `Focus ON`;
	} else {
		btn.textContent = 'Start Focus';
		status.textContent = `Focus OFF`;
	}
}

document.getElementById('toggle').addEventListener('click', async () => {
	const state = await loadState();
	const blacklistRaw = document.getElementById('blacklist').value.trim();
	const blacklist = blacklistRaw
		? blacklistRaw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	if (!state.focusOn) {
		const minutes = Math.max(1, parseInt(document.getElementById('minutes').value || '25', 10));
		const endsAt = Date.now() + minutes * 60 * 1000;

		await chrome.storage.local.set({ focusOn: true, endsAt, blacklist });

		// set alarm for end
		await chrome.alarms.clear('focusEnds');
		chrome.alarms.create('focusEnds', { when: endsAt });
	} else {
		await chrome.storage.local.set({ focusOn: false, endsAt: null, blacklist });
		await chrome.alarms.clear('focusEnds');
	}

	render();
});

// update countdown every second when popup open
render();
setInterval(render, 1000);
