import type ModuleInstance from './main.js'
import * as Options from './options.js'
import { wsApiPostCalls } from './api.js'
import { unhandledOption } from './util.js'
import type { CompanionActionDefinitions } from '@companion-module/base'

/**
 * Action ids. The values are the ids saved against every button using the action, so they must never change —
 * they predate this enum and are camelCase for that reason.
 */
export enum ActionId {
	RouteVideo = 'routeVideo',
	ClearVideo = 'clearVideo',
	AutoRoute = 'autoRoute',
	RouteAudio = 'routeAudio',
}

export type ActionSchema = {
	[ActionId.RouteVideo]: { options: { source: string; destination: string; audio: boolean } }
	[ActionId.ClearVideo]: { options: { destination: string } }
	[ActionId.AutoRoute]: { options: { enable: Options.AutoRouteState } }
	[ActionId.RouteAudio]: { options: { source: string; destination: string } }
}

/**
 * Sets every action the connected device doesn't offer to `undefined`, which is how Companion is told it isn't
 * available. The definitions type requires every key, so this also narrows away the `Partial`.
 */
function ensureAllActionKeys(
	actions: Partial<CompanionActionDefinitions<ActionSchema>>,
): asserts actions is CompanionActionDefinitions<ActionSchema> {
	for (const id of Object.values(ActionId)) {
		if (!(id in actions)) actions[id] = undefined
	}
}

/** The auto route state to send, given the action's choice and the device's current state */
export function autoRouteState(enable: Options.AutoRouteState, current: boolean): boolean {
	switch (enable) {
		case 'on':
			return true
		case 'off':
			return false
		case 'toggle':
			return !current
		default:
			return unhandledOption(enable, !current)
	}
}

export function UpdateActions(self: ModuleInstance): void {
	if (!self.crestronDevice) {
		self.log('warn', 'Actions not set: No device data')
		return
	}

	const actions: Partial<CompanionActionDefinitions<ActionSchema>> = {}

	actions[ActionId.RouteVideo] = {
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
		callback: async (event, context) => {
			const { destination: dest, source } = event.options
			if (!dest || !source) {
				throw new Error(`Action: ${event.actionId}:${event.id} - Source or Destination not set`)
			}
			const msg = event.options.audio
				? wsApiPostCalls.routeAudioVideo(dest, source)
				: wsApiPostCalls.routeVideo(dest, source)
			await self.wsSend(msg, 1, context.signal)
		},
		learn: (event) => {
			const routes = self.crestronDevice.routes
			const dest = event.options.destination
			if (dest && dest in routes) {
				const route = routes[dest]
				if (route && 'VideoSource' in route) {
					return { source: route.VideoSource }
				}
			}
			return undefined
		},
	}
	actions[ActionId.ClearVideo] = {
		name: 'Output - Clear Route',
		options: [Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting)],
		callback: async (event, context) => {
			const dest = event.options.destination
			if (!dest) {
				throw new Error(`Action: ${event.actionId}:${event.id} - Destination not set`)
			}
			await self.wsSend(wsApiPostCalls.clearRoute(dest), 1, context.signal)
		},
	}
	actions[ActionId.AutoRoute] = {
		name: 'Auto Route',
		options: [Options.autoRouteOption()],
		callback: async (event, context) => {
			const state = autoRouteState(event.options.enable, self.crestronDevice.autoRoute)
			await self.wsSend(wsApiPostCalls.autoRoute(state), 1, context.signal)
		},
	}
	if (
		self.crestronDevice.inputChoicesSupportingAudioRouting.length > 0 &&
		self.crestronDevice.outputChoicesSupportingAudioRouting.length > 0
	) {
		actions[ActionId.RouteAudio] = {
			name: 'Output - Route Audio',
			options: [
				Options.sourceOption(self.crestronDevice.inputChoicesSupportingAudioRouting),
				Options.destinationOption(self.crestronDevice.outputChoicesSupportingAudioRouting),
			],
			callback: async (event, context) => {
				const { destination: dest, source } = event.options
				if (!dest || !source) {
					throw new Error(`Action: ${event.actionId}:${event.id} - Source or Destination not set`)
				}
				const msg = wsApiPostCalls.routeAudio(dest, source)
				await self.wsSend(msg, 1, context.signal)
			},
			learn: (event) => {
				const routes = self.crestronDevice.routes
				const dest = event.options.destination
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'AudioSource' in route) {
						return { source: route.AudioSource }
					}
				}
				return undefined
			},
		}
	}
	ensureAllActionKeys(actions)
	self.setActionDefinitions(actions)
}
