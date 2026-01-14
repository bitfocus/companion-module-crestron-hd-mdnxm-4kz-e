import { combineRgb, CompanionFeedbackContext, CompanionFeedbackInfo } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { InnerDevice } from './schemas/Device.js'
import * as Options from './options.js'

const feedbackSubscribe =
	(instance: ModuleInstance, types: Array<keyof InnerDevice>) =>
	(feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): void => {
		types.forEach((type) => {
			instance.feedbackSubscriptions[type].add(feedback.id)
		})
	}

const feedbackUnsubscribe =
	(instance: ModuleInstance, types: Array<keyof InnerDevice>) =>
	(feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): void => {
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
	self.setFeedbackDefinitions({
		videoSource: {
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
				const dest = feedback.options.destination?.toString() ?? ''
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
			subscribe: feedbackSubscribe(self, ['AvMatrixRoutingV2', 'AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2', 'AvioV2']),
		},
		videoDestinationName: {
			name: 'Destination - Name',
			description: `Get a destination's user specified name`,
			type: 'value',
			options: [Options.destinationOption(self.crestronDevice.outputChoices)],
			callback: (feedback) => {
				const dest = feedback.options.destination?.toString() ?? ''
				const AvioOutputs = self.crestronDevice.AvioV2.Outputs
				if (dest in AvioOutputs) return AvioOutputs[dest].UserSpecifiedName
				return 'name not found'
			},
			subscribe: feedbackSubscribe(self, ['AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		videoDestinationSinkConnected: {
			name: 'Destination - Sink Connected',
			description: `Get a destination's sink connected status`,
			type: 'boolean',
			defaultStyle: styles.blackOnGreen,
			options: [Options.destinationOption(self.crestronDevice.outputChoices)],
			callback: (feedback) => {
				const dest = feedback.options.destination?.toString() ?? ''

				const AvioOutputs = self.crestronDevice.AvioV2.Outputs
				if (dest in AvioOutputs) {
					const OutputPorts = AvioOutputs[dest].OutputInfo.Ports
					for (const [_portName, portInfo] of Object.entries(OutputPorts)) {
						if ('IsSinkConnected' in portInfo && portInfo.IsSinkConnected) {
							return portInfo.IsSinkConnected
							break
						}
					}
				}
				return false
			},
			subscribe: feedbackSubscribe(self, ['AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},

		videoSourceTally: {
			name: 'Destination - Video Tally Source',
			description: `Tally a video crosspoint`,
			type: 'boolean',
			defaultStyle: styles.blackOnRed,
			options: [
				Options.sourceOption(self.crestronDevice.inputChoicesSupportingVideoRouting),
				Options.destinationOption(self.crestronDevice.outputChoicesSupportingVideoRouting),
			],
			callback: (feedback) => {
				const dest = feedback.options.destination?.toString() ?? ''
				const source = feedback.options.source?.toString() ?? ''
				const routes = self.crestronDevice.routes
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
			subscribe: feedbackSubscribe(self, ['AvMatrixRoutingV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvMatrixRoutingV2']),
		},
		videoSourceName: {
			name: 'Source - Name',
			description: `Get a source's user specified name`,
			type: 'value',
			options: [Options.sourceOption(self.crestronDevice.inputChoices)],
			callback: (feedback) => {
				const source = feedback.options.source?.toString() ?? ''
				const AvioInputs = self.crestronDevice.AvioV2.Inputs
				if (source in AvioInputs) return AvioInputs[source].UserSpecifiedName
				return ''
			},
			subscribe: feedbackSubscribe(self, ['AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		videoSourceSinkConnected: {
			name: 'Source - Sync Detected',
			description: `Get a source's sync detected status`,
			type: 'boolean',
			defaultStyle: styles.blackOnGreen,
			options: [Options.sourceOption(self.crestronDevice.inputChoices)],
			callback: (feedback) => {
				const source = feedback.options.source?.toString() ?? ''
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
			subscribe: feedbackSubscribe(self, ['AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
	})
}
