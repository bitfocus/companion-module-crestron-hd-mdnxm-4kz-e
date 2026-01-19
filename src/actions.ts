import type { ModuleInstance } from './main.js'
import * as Options from './options.js'
import { wsApiPostCalls } from './api.js'
import type { CompanionActionDefinition } from '@companion-module/base'

export function UpdateActions(self: ModuleInstance): void {
	if (!self.crestronDevice) {
		self.log('warn', 'Actions not set: No device data')
		return
	}

	const actions: Record<string, CompanionActionDefinition> = {}

	actions.routeVideo = {
		name: 'Output - Route Video',
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
				throw new Error(`Action: ${event.actionId}:${event.id} - Source or Destination not set`)
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
					return {
						...event.options,
						source: route.VideoSource,
					}
				}
			}
			return undefined
		},
	}
	/* actions.clearVideo = {
		name: 'Output - Clear Routes',
		options: [Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting)],
		callback: async (event) => {
			const dest = event.options.destination?.toString() ?? ''
			if (dest === '') {
				throw new Error(`Action: ${event.actionId}:${event.id} - Destination not set`)
			}
			await self.wsSend(wsApiPostCalls.clearRoute(dest))
		},
	} */
	if (
		self.crestronDevice.inputChoicesSupportingAudioRouting.length > 0 &&
		self.crestronDevice.outputChoicesSupportingAudioRouting.length > 0
	) {
		actions.routeAudio = {
			name: 'Output - Route Audio',
			options: [
				Options.sourceOption(self.crestronDevice.inputChoicesSupportingAudioRouting),
				Options.destinationOption(self.crestronDevice.outputChoicesSupportingAudioRouting),
			],
			callback: async (event) => {
				const dest = event.options.destination?.toString() ?? ''
				const source = event.options.source?.toString() ?? ''
				if (dest === '' || source === '') {
					throw new Error(`Action: ${event.actionId}:${event.id} - Source or Destination not set`)
				}
				const msg = wsApiPostCalls.routeAudio(dest, source)
				await self.wsSend(msg)
			},
			learn: (event) => {
				const routes = self.crestronDevice.routes
				const dest = event.options.destination?.toString() ?? ''
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'AudioSource' in route) {
						return {
							...event.options,
							source: route.AudioSource,
						}
					}
				}
				return undefined
			},
		}
	}
	self.setActionDefinitions(actions)
}
