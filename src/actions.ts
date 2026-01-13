import type { ModuleInstance } from './main.js'

export function UpdateActions(self: ModuleInstance): void {
	if (!self.crestronDevice) {
		return
	}
	self.setActionDefinitions({
		routeVideo: {
			name: 'Route Video',
			options: [
				{
					id: 'source',
					type: 'dropdown',
					label: 'Source',
					choices: self.crestronDevice.inputChoicesSupportingVideoRouting,
					default: self.crestronDevice.inputChoicesSupportingVideoRouting[0].id,
				},
				{
					id: 'destination',
					type: 'dropdown',
					label: 'Destination',
					choices: self.crestronDevice.outputChoicesSupportingVideoRouting,
					default: self.crestronDevice.outputChoicesSupportingVideoRouting[0].id,
				},
				{
					id: 'audio',
					type: 'checkbox',
					label: 'Also route audio',
					default: true,
				},
			],
			callback: async (event) => {
				const dest = event.options.destination?.toString() ?? ''
				const source = event.options.source?.toString() ?? ''
				if (dest === '' || source === '') {
					self.log('warn', `Action: ${event.actionId}:${event.id} - Source or Destination not set for routing action`)
					return
				}
				const command = event.options.audio ? { VideoSource: source, AudioSource: source } : { VideoSource: source }
				const msg = JSON.stringify({
					Device: {
						AvMatrixRoutingV2: {
							Routes: {
								[dest]: command,
							},
						},
					},
				})
				try {
					await self.wsSend(msg)
				} catch (err) {
					self.handleError(err)
				}
			},
			learn: (event) => {
				const routes = self.crestronDevice.routes
				const dest = event.options.destination?.toString() ?? ''
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'VideoSource' in route) {
						const currentSource = route.VideoSource
						return {
							...event.options,
							source: currentSource,
						}
					}
				}
				return undefined
			},
		},
	})
}
