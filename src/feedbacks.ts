import {
	combineRgb,
	type CompanionFeedbackContext,
	type CompanionFeedbackDefinitions,
	type CompanionFeedbackInfo,
	type CompanionOptionValues,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import { InnerDevice } from './schemas/Device.js'
import * as Options from './options.js'

/**
 * Feedback ids. The values are the ids saved against every button using the feedback, so they must never change —
 * they predate this enum and are camelCase for that reason.
 */
export enum FeedbackId {
	VideoSource = 'videoSource',
	VideoDestinationName = 'videoDestinationName',
	VideoDestinationSinkConnected = 'videoDestinationSinkConnected',
	VideoSourceTally = 'videoSourceTally',
	VideoSourceName = 'videoSourceName',
	VideoSourceSyncDetected = 'videoSourceSyncDetected',
	AudioSource = 'audioSource',
	AudioSourceTally = 'audioSourceTally',
	AutomaticRouting = 'automaticRouting',
}

export type FeedbackSchema = {
	[FeedbackId.VideoSource]: { type: 'value'; options: { destination: string; name: boolean }; result: string | number }
	[FeedbackId.VideoDestinationName]: { type: 'value'; options: { destination: string }; result: string }
	[FeedbackId.VideoDestinationSinkConnected]: { type: 'boolean'; options: { destination: string } }
	[FeedbackId.VideoSourceTally]: { type: 'boolean'; options: { source: string; destination: string } }
	[FeedbackId.VideoSourceName]: { type: 'value'; options: { source: string }; result: string }
	[FeedbackId.VideoSourceSyncDetected]: { type: 'boolean'; options: { source: string } }
	[FeedbackId.AudioSource]: { type: 'value'; options: { destination: string; name: boolean }; result: string | number }
	[FeedbackId.AudioSourceTally]: { type: 'boolean'; options: { source: string; destination: string } }
	[FeedbackId.AutomaticRouting]: { type: 'boolean'; options: Record<string, never> }
}

/**
 * Registers a feedback against the device data it reads, so a WebSocket update to that data rechecks it.
 * Called from each callback: API 2.x has no feedback subscribe hook, and a feedback being evaluated is one in use,
 * so it re-registers on every check and can't drift out of the registry while still on a button.
 */
export function feedbackSubscribe(
	instance: ModuleInstance,
	types: Array<keyof InnerDevice>,
	feedback: CompanionFeedbackInfo<CompanionOptionValues>,
): void {
	types.forEach((type) => {
		instance.feedbackSubscriptions[type].add(feedback.id)
	})
}

const feedbackUnsubscribe =
	(instance: ModuleInstance, types: Array<keyof InnerDevice>) =>
	(feedback: CompanionFeedbackInfo<CompanionOptionValues>, _context: CompanionFeedbackContext): void => {
		types.forEach((type) => {
			instance.feedbackSubscriptions[type].delete(feedback.id)
		})
	}

const styles = {
	blackOnGreen: {
		bgcolor: combineRgb(0, 204, 0),
		color: combineRgb(0, 0, 0),
	},
	blackOnRed: {
		bgcolor: combineRgb(255, 0, 0),
		color: combineRgb(0, 0, 0),
	},
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions<FeedbackSchema> = {
		[FeedbackId.VideoSource]: {
			name: 'Destination - Video Source',
			description: `Get the video source routed to a destination`,
			type: 'value',
			options: [
				Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting),
				{
					id: 'name',
					type: 'checkbox',
					label: 'Name',
					default: true,
					description: 'Return the user specified source name ',
				},
			],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvMatrixRoutingV2', 'AvioV2'], feedback)
				const dest = feedback.options.destination
				const config = self.crestronDevice.AvRoutingMatrixV2.Config
				if (config) {
					const destConfig: (typeof config)[string] | undefined = config[dest]
					if (destConfig && 'VideoSourceConfigured' in destConfig && destConfig.VideoSourceConfigured == 'No Source')
						return feedback.options.name ? 'No Source' : 0
				}
				let source: string = ''
				const routes = self.crestronDevice.routes
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'VideoSource' in route) {
						source = route.VideoSource
					}
				}
				if (feedback.options.name) {
					const AvioInputs = self.crestronDevice.AvioV2.Inputs
					if (source in AvioInputs) source = AvioInputs[source].UserSpecifiedName
				}
				return source
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2', 'AvioV2']),
		},
		[FeedbackId.VideoDestinationName]: {
			name: 'Destination - Name',
			description: `Get a destination's user specified name`,
			type: 'value',
			options: [Options.destinationOption(self.crestronDevice.outputChoices)],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvioV2'], feedback)
				const dest = feedback.options.destination
				const AvioOutputs = self.crestronDevice.AvioV2.Outputs
				if (dest in AvioOutputs) return AvioOutputs[dest].UserSpecifiedName
				return 'name not found'
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		[FeedbackId.VideoDestinationSinkConnected]: {
			name: 'Destination - Sink Connected',
			description: `Get a destination's sink connected status`,
			type: 'boolean',
			defaultStyle: styles.blackOnGreen,
			options: [Options.destinationOption(self.crestronDevice.outputChoices)],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvioV2'], feedback)
				const dest = feedback.options.destination

				const AvioOutputs = self.crestronDevice.AvioV2.Outputs
				if (dest in AvioOutputs) {
					const OutputPorts = AvioOutputs[dest].OutputInfo.Ports
					for (const [_portName, portInfo] of Object.entries(OutputPorts)) {
						if ('IsSinkConnected' in portInfo && portInfo.IsSinkConnected) {
							return portInfo.IsSinkConnected
						}
					}
				}
				return false
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		[FeedbackId.VideoSourceTally]: {
			name: 'Destination - Video Tally Source',
			description: `Tally a video crosspoint`,
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [
				Options.sourceOption(self.crestronDevice.inputChoicesSupportingVideoRouting),
				Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting),
			],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvMatrixRoutingV2'], feedback)
				const { destination: dest, source } = feedback.options
				const routes = self.crestronDevice.routes
				const config = self.crestronDevice.AvRoutingMatrixV2.Config
				if (config) {
					const destConfig: (typeof config)[string] | undefined = config[dest]
					if (destConfig && 'VideoSourceConfigured' in destConfig && destConfig.VideoSourceConfigured == 'No Source')
						return false
				}
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'VideoSource' in route) {
						return route.VideoSource === source
					}
				}
				return false
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
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2']),
		},
		[FeedbackId.VideoSourceName]: {
			name: 'Source - Name',
			description: `Get a source's user specified name`,
			type: 'value',
			options: [Options.sourceOption(self.crestronDevice.inputChoices)],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvioV2'], feedback)
				const source = feedback.options.source
				const AvioInputs = self.crestronDevice.AvioV2.Inputs
				if (source in AvioInputs) return AvioInputs[source].UserSpecifiedName
				return ''
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		[FeedbackId.VideoSourceSyncDetected]: {
			name: 'Source - Sync Detected',
			description: `Get a source's sync detected status`,
			type: 'boolean',
			defaultStyle: styles.blackOnGreen,
			options: [Options.sourceOption(self.crestronDevice.inputChoices)],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvioV2'], feedback)
				const source = feedback.options.source
				const AvioInputs = self.crestronDevice.AvioV2.Inputs
				if (source in AvioInputs) {
					const InputPorts = AvioInputs[source].InputInfo.Ports
					for (const [_portName, portInfo] of Object.entries(InputPorts)) {
						if ('IsSyncDetected' in portInfo && portInfo.IsSyncDetected) {
							return portInfo.IsSyncDetected
						}
					}
				}
				return false
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		[FeedbackId.AudioSource]: {
			name: 'Destination - Audio Source',
			description: `Get the audio source routed to a destination`,
			type: 'value',
			options: [
				Options.destinationOption(self.crestronDevice.outputChoices),
				{
					id: 'name',
					type: 'checkbox',
					label: 'Name',
					default: true,
					description: 'Return the user specified source name ',
				},
			],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvMatrixRoutingV2', 'AvioV2'], feedback)
				const dest = feedback.options.destination
				let source: string = ''
				const routes = self.crestronDevice.routes
				const config = self.crestronDevice.AvRoutingMatrixV2.Config
				if (config) {
					const destConfig: (typeof config)[string] | undefined = config[dest]
					if (destConfig && 'AudioSourceConfigured' in destConfig && destConfig.AudioSourceConfigured == 'No Source')
						return feedback.options.name ? 'No Source' : 0
				}
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'AudioSource' in route) {
						source = route.AudioSource
					}
				}
				if (feedback.options.name) {
					const AvioInputs = self.crestronDevice.AvioV2.Inputs
					if (source in AvioInputs) source = AvioInputs[source].UserSpecifiedName
				}
				return source
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2', 'AvioV2']),
		},
		[FeedbackId.AudioSourceTally]: {
			name: 'Destination - Audio Tally Source',
			description: `Tally a audio crosspoint`,
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [
				Options.sourceOption(self.crestronDevice.inputChoices),
				Options.destinationOption(self.crestronDevice.outputChoices),
			],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvMatrixRoutingV2'], feedback)
				const { destination: dest, source } = feedback.options
				const routes = self.crestronDevice.routes
				const config = self.crestronDevice.AvRoutingMatrixV2.Config
				if (config) {
					const destConfig: (typeof config)[string] | undefined = config[dest]
					if (destConfig && 'AudioSourceConfigured' in destConfig && destConfig.AudioSourceConfigured == 'No Source')
						return false
				}
				if (dest && dest in routes) {
					const route = routes[dest]
					if (route && 'AudioSource' in route) {
						return route.AudioSource === source
					}
				}
				return false
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
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2']),
		},
		[FeedbackId.AutomaticRouting]: {
			name: 'Auto Route',
			description: `Is Auto Route enabled`,
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [],
			callback: (feedback) => {
				feedbackSubscribe(self, ['AvMatrixRoutingV2'], feedback)
				return self.crestronDevice.autoRoute
			},
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2']),
		},
	}
	self.setFeedbackDefinitions(feedbacks)
}
