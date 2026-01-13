import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		videoSource: {
			name: 'Destination - Video Source',
			description: `Get the video source routed to a destination`,
			type: 'value',
			options: [
				{
					id: 'destination',
					type: 'dropdown',
					label: 'Destination',
					choices: self.crestronDevice.outputChoicesSupportingVideoRouting,
					default: self.crestronDevice.outputChoicesSupportingVideoRouting[0].id,
				},
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
		},
		videoDestinationName: {
			name: 'Destination - Name',
			description: `Get a destination's user specified name`,
			type: 'value',
			options: [
				{
					id: 'destination',
					type: 'dropdown',
					label: 'Destination',
					choices: self.crestronDevice.outputChoices,
					default: self.crestronDevice.outputChoices[0].id,
				},
			],
			callback: (feedback) => {
				const dest = feedback.options.destination?.toString() ?? ''
				let destName: string = ''
				if (feedback.options.name) {
					const AvioOutputs = self.crestronDevice.AvioV2.Outputs
					if (dest in AvioOutputs) destName = AvioOutputs[dest].UserSpecifiedName
				}
				return destName
			},
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
		},
		videoSourceName: {
			name: 'Source - Name',
			description: `Get a source's user specified name`,
			type: 'value',
			options: [
				{
					id: 'source',
					type: 'dropdown',
					label: 'Source',
					choices: self.crestronDevice.inputChoices,
					default: self.crestronDevice.inputChoices[0].id,
				},
			],
			callback: (feedback) => {
				const source = feedback.options.source?.toString() ?? ''
				let sourceName: string = ''
				const AvioInputs = self.crestronDevice.AvioV2.Inputs
				if (source in AvioInputs) sourceName = AvioInputs[source].UserSpecifiedName
				return sourceName
			},
		},
	})
}
