const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('griff', {
	// Config window API
	getStatus: () => ipcRenderer.invoke('get-status'),
	getSettings: () => ipcRenderer.invoke('get-settings'),
	saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
	startFocus: (duration) => ipcRenderer.invoke('start-focus', duration),
	stopFocus: () => ipcRenderer.invoke('stop-focus'),
	addCategory: (category) => ipcRenderer.invoke('add-category', category),
	deleteCategory: (categoryId) => ipcRenderer.invoke('delete-category', categoryId),

	// Overlay mouse control
	setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

	// Event listeners
	onFocusStarted: (callback) => ipcRenderer.on('focus-started', (_e, data) => callback(data)),
	onFocusStopped: (callback) => ipcRenderer.on('focus-stopped', () => callback()),
	onTimerTick: (callback) => ipcRenderer.on('timer-tick', (_e, data) => callback(data)),
	onAppStatus: (callback) => ipcRenderer.on('app-status', (_e, data) => callback(data))
});
