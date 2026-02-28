const http = require('node:http');

class HttpServer {
	constructor(focusManager, port = 52525) {
		this.focusManager = focusManager;
		this.port = port;
		this.server = null;
	}

	start() {
		this.server = http.createServer((req, res) => this._handleRequest(req, res));

		this.server.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				console.error(`Port ${this.port} in use, trying ${this.port + 1}`);
				this.port++;
				this.server.listen(this.port, '127.0.0.1');
			} else {
				console.error('HTTP server error:', err);
			}
		});

		this.server.listen(this.port, '127.0.0.1', () => {
			console.log(`Griff HTTP server listening on http://127.0.0.1:${this.port}`);
		});
	}

	stop() {
		if (this.server) {
			this.server.close();
			this.server = null;
		}
	}

	_handleRequest(req, res) {
		// CORS headers
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Content-Type', 'application/json');

		// Preflight
		if (req.method === 'OPTIONS') {
			res.writeHead(204);
			res.end();
			return;
		}

		if (req.method === 'GET' && req.url === '/status') {
			const status = this.focusManager.getStatus();
			res.writeHead(200);
			res.end(JSON.stringify({
				running: true,
				...status
			}));
			return;
		}

		if (req.method === 'POST' && req.url === '/start') {
			let body = '';
			req.on('data', (chunk) => { body += chunk; });
			req.on('end', () => {
				try {
					const data = body ? JSON.parse(body) : {};
					const result = this.focusManager.start(data.duration);
					res.writeHead(200);
					res.end(JSON.stringify(result));
				} catch {
					res.writeHead(400);
					res.end(JSON.stringify({ ok: false, error: 'Invalid request' }));
				}
			});
			return;
		}

		if (req.method === 'POST' && req.url === '/stop') {
			const result = this.focusManager.stop();
			res.writeHead(200);
			res.end(JSON.stringify(result));
			return;
		}

		// 404
		res.writeHead(404);
		res.end(JSON.stringify({ error: 'Not found' }));
	}
}

module.exports = { HttpServer };
