export const ApiCalls = {
	login: '/userlogin.html',
	logout: '/logout',
	WsUpgrade: '/websockify',
} as const satisfies Record<string, string>

export type ApiCallValues = (typeof ApiCalls)[keyof typeof ApiCalls]
