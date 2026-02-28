const statusText = document.getElementById('status-text');
const timerText = document.getElementById('timer-text');
const startControls = document.getElementById('start-controls');
const activeControls = document.getElementById('active-controls');
const durationInput = document.getElementById('duration');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const modeSelect = document.getElementById('mode-select');
const appList = document.getElementById('app-list');
const btnSave = document.getElementById('btn-save');
const saveMsg = document.getElementById('save-msg');
const categoryCheckboxes = document.getElementById('category-checkboxes');

// Custom category elements
const categoryNameInput = document.getElementById('category-name');
const categoryDescInput = document.getElementById('category-desc');
const categoryTypeSelect = document.getElementById('category-type');
const categoryAppsInput = document.getElementById('category-apps');
const btnAddCategory = document.getElementById('btn-add-category');
const addCategoryMsg = document.getElementById('add-category-msg');

let categories = [];

// ─── Load current state ───
async function loadStatus() {
	const res = await window.griff.getSettings();
	if (!res) return;

	// Populate settings
	if (res.customApps) appList.value = res.customApps.join('\n');
	if (res.mode) modeSelect.value = res.mode;
	if (res.focusDuration) durationInput.value = res.focusDuration;

	// Load categories
	if (res.categories) {
		categories = res.categories;
		populateCategoryCheckboxes(res.selectedCategories || []);
	}

	if (res.focusActive) {
		showActiveState(res.focusEnd);
	} else {
		showIdleState();
	}
}

function populateCategoryCheckboxes(selectedCategories) {
	categoryCheckboxes.innerHTML = '';

	for (const category of categories) {
		const item = document.createElement('div');
		item.className = 'category-item';

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = `cat-${category.id}`;
		checkbox.value = category.id;
		checkbox.checked = selectedCategories.includes(category.id);

		const info = document.createElement('div');
		info.className = 'category-info';

		const label = document.createElement('label');
		label.htmlFor = `cat-${category.id}`;
		label.className = 'category-name';
		label.textContent = category.name;

		// Type badge (approved/blocked)
		if (category.type) {
			const typeBadge = document.createElement('span');
			typeBadge.className = `type-badge ${category.type}`;
			typeBadge.textContent = category.type;
			label.appendChild(document.createTextNode(' '));
			label.appendChild(typeBadge);
		}

		// Custom badge
		if (category.custom) {
			const badge = document.createElement('span');
			badge.className = 'custom-badge';
			badge.textContent = 'Custom';
			label.appendChild(document.createTextNode(' '));
			label.appendChild(badge);
		}

		const desc = document.createElement('div');
		desc.className = 'category-description';
		desc.textContent = category.description;

		info.appendChild(label);
		info.appendChild(desc);

		const apps = document.createElement('div');
		apps.className = 'category-apps';
		apps.textContent = category.apps.join(', ');

		item.appendChild(checkbox);
		item.appendChild(info);
		item.appendChild(apps);

		// Delete button for custom categories
		if (category.custom) {
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn-delete-category';
			deleteBtn.textContent = '\u00D7';
			deleteBtn.title = 'Delete category';
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				deleteCategory(category.id);
			});
			item.appendChild(deleteBtn);
		}

		categoryCheckboxes.appendChild(item);

		// Auto-save when checkbox changes
		checkbox.addEventListener('change', saveSettings);
	}
}

function showActiveState(endTime) {
	statusText.innerHTML = 'Focus mode is <strong style="color:#4caf50">ON</strong>';
	timerText.classList.remove('hidden');
	startControls.classList.add('hidden');
	activeControls.classList.remove('hidden');
	updateTimer(endTime);
}

function showIdleState() {
	statusText.innerHTML = 'Focus mode is <strong>OFF</strong>';
	timerText.classList.add('hidden');
	timerText.textContent = '';
	startControls.classList.remove('hidden');
	activeControls.classList.add('hidden');
}

function updateTimer(endTime) {
	const remaining = Math.max(0, endTime - Date.now());
	if (remaining <= 0) {
		showIdleState();
		return;
	}
	const mins = Math.floor(remaining / 60000);
	const secs = Math.floor((remaining % 60000) / 1000);
	timerText.textContent = `${pad(mins)}:${pad(secs)} remaining`;
}

function pad(n) {
	return String(n).padStart(2, '0');
}

// ─── Actions ───
btnStart.addEventListener('click', async () => {
	const duration = parseInt(durationInput.value, 10) || 25;
	const res = await window.griff.startFocus(duration);
	if (res && res.ok) showActiveState(res.focusEnd);
});

btnStop.addEventListener('click', async () => {
	await window.griff.stopFocus();
	showIdleState();
});

async function saveSettings() {
	const customApps = appList.value
		.split('\n')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	const mode = modeSelect.value;
	const focusDuration = parseInt(durationInput.value, 10) || 25;

	// Get selected categories
	const selectedCategories = [];
	const checkboxes = categoryCheckboxes.querySelectorAll('input[type="checkbox"]');
	for (const cb of checkboxes) {
		if (cb.checked) {
			selectedCategories.push(cb.value);
		}
	}

	await window.griff.saveSettings({ customApps, selectedCategories, mode, focusDuration });
	saveMsg.classList.remove('hidden');
	setTimeout(() => saveMsg.classList.add('hidden'), 1500);
}

btnSave.addEventListener('click', saveSettings);

// ─── Add Custom Category ───
btnAddCategory.addEventListener('click', async () => {
	const name = categoryNameInput.value.trim();
	const description = categoryDescInput.value.trim();
	const type = categoryTypeSelect.value;
	const appsText = categoryAppsInput.value.trim();

	if (!name) {
		alert('Please enter a category name');
		return;
	}
	if (!appsText) {
		alert('Please enter at least one app process name');
		return;
	}

	const id = name.toLowerCase().replace(/\s+/g, '_');
	const apps = appsText
		.split('\n')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	const res = await window.griff.addCategory({ id, name, description: description || name, apps, type });
	if (res && res.ok) {
		categoryNameInput.value = '';
		categoryDescInput.value = '';
		categoryAppsInput.value = '';
		addCategoryMsg.classList.remove('hidden');
		setTimeout(() => addCategoryMsg.classList.add('hidden'), 1500);
		loadStatus();
	}
});

async function deleteCategory(categoryId) {
	if (!confirm('Are you sure you want to delete this category?')) return;
	const res = await window.griff.deleteCategory(categoryId);
	if (res && res.ok) loadStatus();
}

// ─── IPC Events from main process ───
window.griff.onFocusStarted((data) => {
	showActiveState(data.focusEnd);
});

window.griff.onFocusStopped(() => {
	showIdleState();
});

window.griff.onTimerTick((data) => {
	const { timeRemaining } = data;
	const mins = Math.floor(timeRemaining / 60);
	const secs = timeRemaining % 60;
	timerText.textContent = `${pad(mins)}:${pad(secs)} remaining`;
	timerText.classList.remove('hidden');
});

// ─── Init ───
loadStatus();
