import { combineRgb, CompanionFeedbackContext, CompanionFeedbackInfo } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { InnerDevice } from './schemas/Device.js'
import * as Options from './options.js'

export const feedbackSubscribe =
	(instance: ModuleInstance, types: Array<keyof InnerDevice>) =>
	(feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): void => {
		types.forEach((type) => {
			instance.feedbackSubscriptions[type].add(feedback.id)
		})
	}

export const feedbackUnsubscribe =
	(instance: ModuleInstance, types: Array<keyof InnerDevice>) =>
	(feedback: CompanionFeedbackInfo, _context: CompanionFeedbackContext): void => {
		types.forEach((type) => {
			instance.feedbackSubscriptions[type].delete(feedback.id)
		})
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
				let destName: string = ''
				if (feedback.options.name) {
					const AvioOutputs = self.crestronDevice.AvioV2.Outputs
					if (dest in AvioOutputs) destName = AvioOutputs[dest].UserSpecifiedName
				}
				return destName
			},
			subscribe: feedbackSubscribe(self, ['AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
		videoSourceTally: {
			name: 'Destination - Video Tally Source',
			description: `Tally a video crosspoint`,
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(0, 0, 0),
			},
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
				let sourceName: string = ''
				const AvioInputs = self.crestronDevice.AvioV2.Inputs
				if (source in AvioInputs) sourceName = AvioInputs[source].UserSpecifiedName
				return sourceName
			},
			subscribe: feedbackSubscribe(self, ['AvioV2']),
			unsubscribe: feedbackUnsubscribe(self, ['AvioV2']),
		},
	})
}
