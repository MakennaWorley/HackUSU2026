const { EventEmitter } = require('node:events');

class FocusManager extends EventEmitter {
	constructor(store) {
		super();
		this.store = store;
		this.tickInterval = null;

		// Resume active session if one exists
		if (store.get('focusActive') && store.get('focusEnd') > Date.now()) {
			this._startTicking();
		} else if (store.get('focusActive')) {
			// Session expired while app was closed
			store.set('focusActive', false);
			store.set('focusEnd', 0);
		}
	}

	start(durationMinutes) {
		const duration = durationMinutes || this.store.get('focusDuration') || 25;
		const focusEnd = Date.now() + duration * 60 * 1000;

		this.store.update({
			focusActive: true,
			focusEnd,
			focusDuration: duration
		});

		this._startTicking();
		this.emit('started', { focusEnd });

		return { ok: true, focusEnd };
	}

	stop() {
		this._stopTicking();
		this.store.update({
			focusActive: false,
			focusEnd: 0
		});
		this.emit('stopped');
		return { ok: true };
	}

	isActive() {
		return this.store.get('focusActive') === true;
	}

	getStatus() {
		const focusActive = this.store.get('focusActive');
		const focusEnd = this.store.get('focusEnd') || 0;
		const timeRemaining = focusActive ? Math.max(0, Math.floor((focusEnd - Date.now()) / 1000)) : 0;

		return { focusActive, focusEnd, timeRemaining };
	}

	_startTicking() {
		this._stopTicking();
		this.tickInterval = setInterval(() => {
			const focusEnd = this.store.get('focusEnd');
			if (Date.now() >= focusEnd) {
				this.stop();
				return;
			}
			const timeRemaining = Math.max(0, Math.floor((focusEnd - Date.now()) / 1000));
			this.emit('tick', { timeRemaining });
		}, 1000);
	}

	_stopTicking() {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}
}

module.exports = { FocusManager };
