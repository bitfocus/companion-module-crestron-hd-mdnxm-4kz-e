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
		name: 'Video - Route',
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
	actions.clearVideo = {
		name: 'Video - Clear Route',
		options: [
			Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting),
			{
				id: 'audio',
				type: 'checkbox',
				label: 'Force clear audio route',
				default: true,
			},
		],
		callback: async (event) => {
			const dest = event.options.destination?.toString() ?? ''
			if (dest === '') {
				throw new Error(`Action: ${event.actionId}:${event.id} - Destination not set`)
			}
			const msg = event.options.audio ? wsApiPostCalls.routeAudioVideo(dest, '') : wsApiPostCalls.routeVideo(dest, '')
			await self.wsSend(msg)
		},
	}
	if (
		self.crestronDevice.inputChoicesSupportingAudioRouting.length > 0 &&
		self.crestronDevice.outputChoicesSupportingAudioRouting.length > 0
	) {
		actions.routeAudio = {
			name: 'Audio - Route',
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
		actions.clearAudio = {
			name: 'Audio - Clear Route',
			options: [Options.destinationOption(self.crestronDevice.outputChoicesSupportingAudioRouting)],
			callback: async (event) => {
				const dest = event.options.destination?.toString() ?? ''
				if (dest === '') {
					throw new Error(`Action: ${event.actionId}:${event.id} - Destination not set`)
				}
				const msg = wsApiPostCalls.routeAudio(dest, '')
				await self.wsSend(msg)
			},
		}
	}
	self.setActionDefinitions(actions)
}
