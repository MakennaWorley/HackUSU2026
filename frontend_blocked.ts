const DEFAULT_STATE = { focusOn: false, endsAt: null };

function fmt(ms) {
	const s = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${String(r).padStart(2, '0')}`;
}

async function render() {
	const state = await chrome.storage.local.get(DEFAULT_STATE);
	const el = document.getElementById('remaining');
	if (state.focusOn && state.endsAt) el.textContent = `Remaining: ${fmt(state.endsAt - Date.now())}`;
	else el.textContent = 'Focus is off.';
}

document.getElementById('end').addEventListener('click', async () => {
	await chrome.storage.local.set({ focusOn: false, endsAt: null });
	// go somewhere neutral
	window.location.href = 'https://www.google.com';
});

render();
setInterval(render, 1000);
