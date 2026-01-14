import type { ModuleInstance } from './main.js'
import * as Options from './options.js'
import { wsApiPostCalls } from './api.js'

export function UpdateActions(self: ModuleInstance): void {
	if (!self.crestronDevice) {
		return
	}
	self.setActionDefinitions({
		routeVideo: {
			name: 'Route Video',
			options: [
				Options.sourceOption(self.crestronDevice.inputChoicesSupportingVideoRouting),
				Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting),
				{
					id: 'audio',
					type: 'checkbox',
					label: 'Force route audio',
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
				const msg = event.options.audio
					? wsApiPostCalls.routeAudioVideo(dest, source)
					: wsApiPostCalls.routeVideo(dest, source)
				await self.wsSend(msg)
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
