const statusText = document.getElementById('status-text');
const timerText = document.getElementById('timer-text');
const startControls = document.getElementById('start-controls');
const activeControls = document.getElementById('active-controls');
const durationInput = document.getElementById('duration');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const modeSelect = document.getElementById('mode-select');
const siteList = document.getElementById('site-list');
const btnSave = document.getElementById('btn-save');
const saveMsg = document.getElementById('save-msg');
const categoryCheckboxes = document.getElementById('category-checkboxes');

// Custom category elements
const categoryNameInput = document.getElementById('category-name');
const categoryDescInput = document.getElementById('category-desc');
const categorySitesInput = document.getElementById('category-sites');
const btnAddCategory = document.getElementById('btn-add-category');
const addCategoryMsg = document.getElementById('add-category-msg');

let timerInterval = null;
let categories = [];

// ─── Load current state ───
function loadStatus() {
	chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
		if (!res) return;

		// Populate settings
		if (res.customSites) siteList.value = res.customSites.join('\n');
		if (res.mode) modeSelect.value = res.mode;
		if (res.focusDuration) durationInput.value = res.focusDuration;

		// Load categories and selected categories
		if (res.categories) {
			categories = res.categories;
			populateCategoryCheckboxes(res.selectedCategories || []);
		}

		if (res.focusActive) {
			showActiveState(res.focusEnd);
		} else {
			showIdleState();
		}
	});
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

		// Add (Custom) badge for custom categories
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

		const sites = document.createElement('div');
		sites.className = 'category-sites';
		sites.textContent = category.sites.join(', ');

		item.appendChild(checkbox);
		item.appendChild(info);
		item.appendChild(sites);

		// Add delete button for custom categories
		if (category.custom) {
			const deleteBtn = document.createElement('button');
			deleteBtn.className = 'btn-delete-category';
			deleteBtn.textContent = '×';
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
	clearInterval(timerInterval);
	timerInterval = setInterval(() => updateTimer(endTime), 1000);
}

function showIdleState() {
	statusText.innerHTML = 'Focus mode is <strong>OFF</strong>';
	timerText.classList.add('hidden');
	timerText.textContent = '';
	startControls.classList.remove('hidden');
	activeControls.classList.add('hidden');
	clearInterval(timerInterval);
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
btnStart.addEventListener('click', () => {
	const duration = parseInt(durationInput.value, 10) || 25;
	chrome.runtime.sendMessage({ type: 'START_FOCUS', duration }, (res) => {
		if (res && res.ok) showActiveState(res.end);
	});
});

btnStop.addEventListener('click', () => {
	chrome.runtime.sendMessage({ type: 'STOP_FOCUS' }, () => {
		showIdleState();
	});
});

function saveSettings() {
	const customSites = siteList.value
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

	chrome.runtime.sendMessage(
		{
			type: 'SAVE_SETTINGS',
			customSites,
			selectedCategories,
			mode,
			focusDuration
		},
		() => {
			saveMsg.classList.remove('hidden');
			setTimeout(() => saveMsg.classList.add('hidden'), 1500);
		}
	);
}

btnSave.addEventListener('click', saveSettings);

// ─── Add Custom Category ───
btnAddCategory.addEventListener('click', () => {
	const name = categoryNameInput.value.trim();
	const description = categoryDescInput.value.trim();
	const sitesText = categorySitesInput.value.trim();

	if (!name) {
		alert('Please enter a category name');
		return;
	}

	if (!sitesText) {
		alert('Please enter at least one site');
		return;
	}

	// Generate ID from name
	const id = name.toLowerCase().replace(/\s+/g, '_');

	// Parse sites
	const sites = sitesText
		.split('\n')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	const newCategory = {
		id,
		name,
		description: description || name,
		sites,
		custom: true
	};

	// Send to background to save
	chrome.runtime.sendMessage({ type: 'ADD_CATEGORY', category: newCategory }, (res) => {
		if (res && res.ok) {
			// Clear form
			categoryNameInput.value = '';
			categoryDescInput.value = '';
			categorySitesInput.value = '';

			// Show success message
			addCategoryMsg.classList.remove('hidden');
			setTimeout(() => addCategoryMsg.classList.add('hidden'), 1500);

			// Reload categories
			loadStatus();
		}
	});
});

function deleteCategory(categoryId) {
	if (!confirm('Are you sure you want to delete this category?')) {
		return;
	}

	chrome.runtime.sendMessage({ type: 'DELETE_CATEGORY', categoryId }, (res) => {
		if (res && res.ok) {
			loadStatus();
		}
	});
}

// ─── Init ───
loadStatus();
