export type FocusState = {
	focusOn: boolean;
	endsAt: number | null;
	blacklist: string[];
};

export const DEFAULT_STATE: FocusState = {
	focusOn: false,
	endsAt: null,
	blacklist: ['youtube.com', 'reddit.com', 'x.com', 'twitter.com']
};
