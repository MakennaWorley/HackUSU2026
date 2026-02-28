import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
	TextField,
	Button,
	Typography,
	Autocomplete,
	Chip,
} from '@mui/material';

import { DEFAULT_STATE, type FocusState } from '../backend/state';

function fmtRemaining(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${String(r).padStart(2, '0')}`;
}

async function loadState(): Promise<FocusState> {
	const state = (await chrome.storage.local.get(DEFAULT_STATE)) as Partial<FocusState>;
	return { ...DEFAULT_STATE, ...state };
}

async function saveState(update: Partial<FocusState>): Promise<void> {
	await chrome.storage.local.set(update);
}

const App: React.FC = () => {
	const [state, setState] = useState<FocusState>(DEFAULT_STATE);
	const [minutes, setMinutes] = useState(25);
	const [remaining, setRemaining] = useState(0);

	// load stored state when popup opens
	useEffect(() => {
		void loadState().then((s) => {
			setState(s);
			if (s.focusOn && s.endsAt) {
				setRemaining(s.endsAt - Date.now());
			}
		});
	}, []);

	// tick interval for countdown
	useEffect(() => {
		const iv = setInterval(() => {
			if (state.focusOn && state.endsAt) {
				const rem = state.endsAt - Date.now();
				setRemaining(rem);
				if (rem <= 0) {
					// end focus automatically
					setState((prev) => ({ ...prev, focusOn: false, endsAt: null }));
					saveState({ focusOn: false, endsAt: null });
					chrome.alarms.clear('focusEnds');
				}
			}
		}, 1000);
		return () => clearInterval(iv);
	}, [state]);

	const handleToggle = async () => {
		const blacklist = state.blacklist;
		if (!state.focusOn) {
			const endsAt = Date.now() + minutes * 60 * 1000;
			await saveState({ focusOn: true, endsAt, blacklist });
			await chrome.alarms.clear('focusEnds');
			chrome.alarms.create('focusEnds', { when: endsAt });
			setState({ ...state, focusOn: true, endsAt });
			setRemaining(minutes * 60 * 1000);
		} else {
			await saveState({ focusOn: false, endsAt: null, blacklist });
			await chrome.alarms.clear('focusEnds');
			setState({ ...state, focusOn: false, endsAt: null });
		}
	};

	const domainOptions = [...DEFAULT_STATE.blacklist];

	return (
		<div style={{ padding: 12, width: 280 }}>
			<Typography variant="h5" gutterBottom>
				Good Griff
			</Typography>

			{!state.focusOn && (
				<TextField
					label="Focus minutes"
					type="number"
					value={minutes}
					onChange={(e) =>
						setMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))
					}
					fullWidth
					margin="normal"
				/>
			)}

			{state.focusOn && (
				<Typography variant="h6" gutterBottom>
					Remaining {fmtRemaining(remaining)}
				</Typography>
			)}

			<Autocomplete
				multiple
				freeSolo
				options={domainOptions}
				value={state.blacklist}
				onChange={(e, newValue) => {
					setState((prev) => ({ ...prev, blacklist: newValue as string[] }));
				}}
				renderTags={(value, getTagProps) =>
					value.map((option, index) => (
						<Chip
							variant="outlined"
							label={option}
							{...getTagProps({ index })}
						/>
					))
				}
				renderInput={(params) => (
					<TextField
						{...params}
						label="Blacklist domains"
						placeholder="Add domain"
						margin="normal"
					/>
				)}
				fullWidth
			/>

			<Button
				variant="contained"
				color={state.focusOn ? 'secondary' : 'primary'}
				onClick={handleToggle}
				fullWidth
				sx={{ mt: 2 }}
			>
				{state.focusOn ? 'Stop Focus' : 'Start Focus'}
			</Button>

			<Typography variant="body2" sx={{ mt: 1 }}>
				{state.focusOn ? 'Focus ON' : 'Focus OFF'}
			</Typography>
		</div>
	);
};

const container = document.getElementById('root');
if (container) {
    createRoot(container).render(<App />);
}
