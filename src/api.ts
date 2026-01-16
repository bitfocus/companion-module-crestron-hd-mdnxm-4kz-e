export const ApiCalls = {
	login: '/userlogin.html',
	logout: '/logout',
	WsUpgrade: '/websockify',
	Device: '/Device',
	AvioV2: '/Device/AvioV2',
	AvMatrixRouting: '/Device/AvMatrixRoutingV2',
} as const satisfies Record<string, string>

export type ApiCallValues = (typeof ApiCalls)[keyof typeof ApiCalls]

export const wsApiGetCalls = {
	avioV2: '/Device/AvioV2',
	avioV2Inputs: '/Device/AvioV2/Inputs',
	avioV2Outputs: '/Device/AvioV2/Outputs',
	routingMatrix: '/Device/AvMatrixRoutingV2',
	routingMatrixConfig: '/Device/AvMatrixRoutingV2/Config',
	routingMatrixRoutes: '/Device/AvMatrixRoutingV2/Routes',
} as const satisfies Record<string, string>

export const wsApiPostCalls = {
	routeVideo: (output: string, source: string): string => {
		return JSON.stringify({ Device: { AvMatrixRouting: { Routes: { [output]: { VideoSource: source } } } } })
	},
	routeAudioVideo: (output: string, source: string): string => {
		return JSON.stringify({
			Device: { AvMatrixRouting: { Routes: { [output]: { AudioSource: source, VideoSource: source } } } },
		})
	},
	routeAudio: (output: string, source: string): string => {
		return JSON.stringify({
			Device: { AvMatrixRouting: { Routes: { [output]: { AudioSource: source } } } },
		})
	},
} satisfies Record<string, (output: string, source: string) => string>
