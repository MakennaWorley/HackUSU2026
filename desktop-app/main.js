const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('node:path');

const { Store } = require('./modules/store');
const { FocusManager } = require('./modules/focus-manager');
const { WindowDetector } = require('./modules/window-detector');
const { HttpServer } = require('./modules/http-server');

let configWindow = null;
let overlayWindow = null;
let tray = null;
let store = null;
let focusManager = null;
let windowDetector = null;
let httpServer = null;

function createConfigWindow() {
	configWindow = new BrowserWindow({
		width: 420,
		height: 680,
		resizable: false,
		icon: path.join(__dirname, 'assets', 'griff.png'),
		backgroundColor: '#101820',
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false
		}
	});

	configWindow.loadFile(path.join(__dirname, 'renderer', 'config.html'));
	configWindow.setMenuBarVisibility(false);

	configWindow.on('close', (e) => {
		// Hide to tray instead of quitting
		if (!app.isQuitting) {
			e.preventDefault();
			configWindow.hide();
		}
	});
}

function createOverlayWindow() {
	const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

	overlayWindow = new BrowserWindow({
		width: 320,
		height: 280,
		x: screenW - 330,
		y: screenH - 290,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		skipTaskbar: true,
		resizable: false,
		focusable: false,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false
		}
	});

	overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
	overlayWindow.setIgnoreMouseEvents(true, { forward: true });

	overlayWindow.once('ready-to-show', () => {
		// Only show if focus is already active (e.g., resumed session)
		if (focusManager.isActive()) {
			overlayWindow.show();
		}
	});
}

function createTray() {
	const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'griff.png'));
	tray = new Tray(icon.resize({ width: 16, height: 16 }));
	tray.setToolTip('Get It Done, Griff!');

	const contextMenu = Menu.buildFromTemplate([
		{ label: 'Show Config', click: () => { configWindow?.show(); configWindow?.focus(); } },
		{ type: 'separator' },
		{ label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
	]);

	tray.setContextMenu(contextMenu);
	tray.on('click', () => {
		configWindow?.show();
		configWindow?.focus();
	});
}

function setupIpcHandlers() {
	ipcMain.handle('get-status', () => {
		return focusManager.getStatus();
	});

	ipcMain.handle('get-settings', () => {
		const all = store.getAll();
		return {
			...all,
			categories: store.getAllCategories(),
			...focusManager.getStatus()
		};
	});

	ipcMain.handle('save-settings', (_event, settings) => {
		if (settings.customApps !== undefined) store.data.customApps = settings.customApps;
		if (settings.selectedCategories !== undefined) store.data.selectedCategories = settings.selectedCategories;
		if (settings.mode !== undefined) store.data.mode = settings.mode;
		if (settings.focusDuration !== undefined) store.data.focusDuration = settings.focusDuration;
		store.save();
		return { ok: true };
	});

	ipcMain.handle('start-focus', (_event, duration) => {
		return focusManager.start(duration);
	});

	ipcMain.handle('stop-focus', () => {
		return focusManager.stop();
	});

	ipcMain.handle('add-category', (_event, category) => {
		if (!category) return { ok: false, error: 'No category provided' };

		const allCats = store.getAllCategories();
		if (allCats.some((c) => c.id === category.id)) {
			return { ok: false, error: 'Category with this name already exists' };
		}

		const customCategories = store.get('customCategories') || [];
		customCategories.push({ ...category, custom: true });

		const selected = store.get('selectedCategories') || [];
		selected.push(category.id);

		store.update({ customCategories, selectedCategories: selected });
		return { ok: true };
	});

	ipcMain.handle('delete-category', (_event, categoryId) => {
		if (!categoryId) return { ok: false, error: 'No category ID provided' };

		const customCategories = (store.get('customCategories') || []).filter((c) => c.id !== categoryId);
		const selectedCategories = (store.get('selectedCategories') || []).filter((id) => id !== categoryId);

		store.update({ customCategories, selectedCategories });
		return { ok: true };
	});

	// Overlay mouse passthrough toggle
	ipcMain.on('set-ignore-mouse', (_event, ignore) => {
		if (overlayWindow) {
			if (ignore) {
				overlayWindow.setIgnoreMouseEvents(true, { forward: true });
			} else {
				overlayWindow.setIgnoreMouseEvents(false);
			}
		}
	});
}

function wireEvents() {
	// Focus started -> show overlay, start window detection
	focusManager.on('started', (data) => {
		if (overlayWindow) {
			overlayWindow.show();
			overlayWindow.webContents.send('focus-started', data);
		}
		configWindow?.webContents.send('focus-started', data);
		windowDetector.start(1500);
	});

	// Focus stopped -> hide overlay, stop window detection
	focusManager.on('stopped', () => {
		if (overlayWindow) {
			overlayWindow.webContents.send('focus-stopped');
			// Short delay then hide so the overlay can show a "done" state
			setTimeout(() => overlayWindow?.hide(), 500);
		}
		configWindow?.webContents.send('focus-stopped');
		windowDetector.stop();
	});

	// Timer tick -> update config window
	focusManager.on('tick', (data) => {
		configWindow?.webContents.send('timer-tick', data);
	});

	// Window changed -> evaluate and notify overlay
	windowDetector.on('windowChanged', (info) => {
		const approved = store.isAppApproved(info.processName);
		const isBrowser = store.isBrowser(info.processName);
		overlayWindow?.webContents.send('app-status', { ...info, approved, isBrowser });
	});
}

// ─── App Lifecycle ───

app.whenReady().then(() => {
	store = new Store(app.getPath('userData'));
	focusManager = new FocusManager(store);
	windowDetector = new WindowDetector();
	httpServer = new HttpServer(focusManager);

	createConfigWindow();
	createOverlayWindow();
	createTray();
	setupIpcHandlers();
	wireEvents();
	httpServer.start();

	// If focus was active on restart, start window detection
	if (focusManager.isActive()) {
		windowDetector.start(1500);
	}
});

app.on('before-quit', () => {
	app.isQuitting = true;
	httpServer?.stop();
	windowDetector?.stop();
});

app.on('window-all-closed', () => {
	// Don't quit when windows close; stay in tray
});
