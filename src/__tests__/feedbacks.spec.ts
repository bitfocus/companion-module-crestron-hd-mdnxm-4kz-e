import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionFeedbackCallbackContext,
	CompanionFeedbackContext,
	CompanionFeedbackDefinitions,
	CompanionFeedbackInfo,
	CompanionFeedbackLearnContext,
} from '@companion-module/base'
import { Crestron_HDMDNXM_4KZ } from '../device.js'
import { FeedbackId, UpdateFeedbacks, type FeedbackSchema } from '../feedbacks.js'
import type ModuleInstance from '../main.js'
import type { InnerDevice } from '../schemas/Device.js'
import { loadHdMd8x8Capture } from './fixtures.js'
import type { AxiosResponse } from 'axios'

function setup(Config?: Record<string, Record<string, string>>) {
	const crestronDevice = {
		inputChoices: [
			{ id: 'Input1', label: 'Input1: Camera' },
			{ id: 'Input2', label: 'Input2: Laptop' },
		],
		inputChoicesSupportingVideoRouting: [{ id: 'Input1', label: 'Input1: Camera' }],
		outputChoices: [{ id: 'Output1', label: 'Output1: Screen' }],
		outputChoicesSupportingVideoRouting: [{ id: 'Output1', label: 'Output1: Screen' }],
		routes: { Output1: { AudioSource: 'Input2', VideoSource: 'Input1' } },
		autoRoute: true,
		AvRoutingMatrixV2: { Config },
		AvioV2: {
			Inputs: {
				Input1: { UserSpecifiedName: 'Camera', InputInfo: { Ports: { Port1: { IsSyncDetected: true } } } },
				Input2: { UserSpecifiedName: 'Laptop', InputInfo: { Ports: { Port1: { IsSyncDetected: false } } } },
			},
			Outputs: {
				Output1: { UserSpecifiedName: 'Screen', OutputInfo: { Ports: { Port1: { IsSinkConnected: true } } } },
			},
		},
	}
	const feedbackSubscriptions = Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker()
	const setFeedbackDefinitions = vi.fn<(defs: CompanionFeedbackDefinitions<FeedbackSchema>) => void>()
	const self = { crestronDevice, feedbackSubscriptions, setFeedbackDefinitions } as unknown as ModuleInstance
	UpdateFeedbacks(self)
	return { defs: setFeedbackDefinitions.mock.calls[0][0], feedbackSubscriptions }
}

/** Options covering every feedback, so one event can drive any of them */
const OPTIONS = { source: 'Input1', destination: 'Output1', name: true }

type AnyCallback = (feedback: CompanionFeedbackInfo, context: CompanionFeedbackCallbackContext) => unknown
type AnyUnsubscribe = (feedback: CompanionFeedbackInfo, context: CompanionFeedbackContext) => void
type AnyLearn = (feedback: CompanionFeedbackInfo, context: CompanionFeedbackLearnContext) => unknown

function info(feedbackId: FeedbackId, id = 'fb-1', options: Record<string, string | boolean> = OPTIONS) {
	return { type: 'boolean', id, controlId: 'bank-1', feedbackId, options, previousOptions: null } as const
}

function definition(defs: CompanionFeedbackDefinitions<FeedbackSchema>, id: FeedbackId) {
	const def = defs[id]
	if (!def) throw new Error(`Feedback ${id} not defined`)
	return def as unknown as { callback: AnyCallback; unsubscribe?: AnyUnsubscribe; learn?: AnyLearn }
}

const callbackContext = { signal: new AbortController().signal } as CompanionFeedbackCallbackContext

/** The device data each feedback reads, and so the WebSocket updates that must recheck it */
const DOMAINS: Record<FeedbackId, Array<keyof InnerDevice>> = {
	[FeedbackId.VideoSource]: ['AvMatrixRoutingV2', 'AvioV2'],
	[FeedbackId.VideoDestinationName]: ['AvioV2'],
	[FeedbackId.VideoDestinationSinkConnected]: ['AvioV2'],
	[FeedbackId.VideoSourceTally]: ['AvMatrixRoutingV2'],
	[FeedbackId.VideoSourceName]: ['AvioV2'],
	[FeedbackId.VideoSourceSyncDetected]: ['AvioV2'],
	[FeedbackId.AudioSource]: ['AvMatrixRoutingV2', 'AvioV2'],
	[FeedbackId.AudioSourceTally]: ['AvMatrixRoutingV2'],
	[FeedbackId.AutomaticRouting]: ['AvMatrixRoutingV2'],
}

describe('feedback subscriptions', () => {
	// API 2.x has no feedback subscribe hook, so a feedback that doesn't register from its callback is never
	// rechecked by a WebSocket update: it works when first drawn and then silently goes stale
	it.each(Object.values(FeedbackId))('%s registers from its callback against the data it reads', (id) => {
		const { defs, feedbackSubscriptions } = setup()
		void definition(defs, id).callback(info(id), callbackContext)

		for (const domain of ['AvioV2', 'AvMatrixRoutingV2'] as const) {
			expect(feedbackSubscriptions[domain].has('fb-1')).toBe(DOMAINS[id].includes(domain))
		}
	})

	it.each(Object.values(FeedbackId))('%s unregisters from every domain on unsubscribe', (id) => {
		const { defs, feedbackSubscriptions } = setup()
		const def = definition(defs, id)
		void def.callback(info(id), callbackContext)
		def.unsubscribe?.(info(id), {} as CompanionFeedbackContext)

		expect(feedbackSubscriptions.AvioV2.size).toBe(0)
		expect(feedbackSubscriptions.AvMatrixRoutingV2.size).toBe(0)
	})
})

describe('feedback callbacks', () => {
	it.each([
		[FeedbackId.VideoSource, { destination: 'Output1', name: true }, 'Camera'],
		[FeedbackId.VideoSource, { destination: 'Output1', name: false }, 'Input1'],
		[FeedbackId.AudioSource, { destination: 'Output1', name: true }, 'Laptop'],
		[FeedbackId.VideoDestinationName, { destination: 'Output1' }, 'Screen'],
		[FeedbackId.VideoSourceName, { source: 'Input2' }, 'Laptop'],
		[FeedbackId.VideoSourceTally, { source: 'Input1', destination: 'Output1' }, true],
		[FeedbackId.AudioSourceTally, { source: 'Input1', destination: 'Output1' }, false],
		[FeedbackId.VideoDestinationSinkConnected, { destination: 'Output1' }, true],
		[FeedbackId.VideoSourceSyncDetected, { source: 'Input2' }, false],
		[FeedbackId.AutomaticRouting, {}, true],
	] as const)('%s with %o returns %s', (id, options, expected) => {
		const { defs } = setup()
		expect(definition(defs, id).callback(info(id, 'fb-1', options), callbackContext)).toBe(expected)
	})
})

describe('feedback callbacks with a routing Config', () => {
	// The device API documents a Config of each destination's configured source, though current firmware omits it

	it.each([
		[FeedbackId.VideoSource, { destination: 'Output1', name: true }, 'Camera'],
		[FeedbackId.VideoSourceTally, { source: 'Input1', destination: 'Output1' }, true],
		[FeedbackId.AudioSource, { destination: 'Output1', name: true }, 'Laptop'],
		[FeedbackId.AudioSourceTally, { source: 'Input2', destination: 'Output1' }, true],
	] as const)('%s falls back to the route when Config has no entry for the destination', (id, options, expected) => {
		const { defs } = setup({ Output2: { VideoSourceConfigured: 'No Source', AudioSourceConfigured: 'No Source' } })
		expect(definition(defs, id).callback(info(id, 'fb-1', options), callbackContext)).toBe(expected)
	})

	it.each([
		[FeedbackId.VideoSource, { destination: 'Output1', name: true }, 'No Source'],
		[FeedbackId.VideoSource, { destination: 'Output1', name: false }, 0],
		[FeedbackId.VideoSourceTally, { source: 'Input1', destination: 'Output1' }, false],
		[FeedbackId.AudioSource, { destination: 'Output1', name: true }, 'No Source'],
		[FeedbackId.AudioSource, { destination: 'Output1', name: false }, 0],
		[FeedbackId.AudioSourceTally, { source: 'Input2', destination: 'Output1' }, false],
	] as const)('%s with %o reports %s when Config has the destination on No Source', (id, options, expected) => {
		const { defs } = setup({ Output1: { VideoSourceConfigured: 'No Source', AudioSourceConfigured: 'No Source' } })
		expect(definition(defs, id).callback(info(id, 'fb-1', options), callbackContext)).toBe(expected)
	})
})

describe('feedback callbacks on an HD-MD8X8-4KZ-E capture', () => {
	// The unit sends Config for only some destinations: Output3-6 have routes but no Config entry
	function setupCapture() {
		const crestronDevice = Crestron_HDMDNXM_4KZ.createNewDevice({ data: loadHdMd8x8Capture() } as AxiosResponse)
		const setFeedbackDefinitions = vi.fn<(defs: CompanionFeedbackDefinitions<FeedbackSchema>) => void>()
		const self = {
			crestronDevice,
			feedbackSubscriptions: Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker(),
			setFeedbackDefinitions,
		} as unknown as ModuleInstance
		UpdateFeedbacks(self)
		return setFeedbackDefinitions.mock.calls[0][0]
	}

	it.each([
		[FeedbackId.VideoSource, { destination: 'Output3', name: true }, 'HDMI 8'],
		[FeedbackId.VideoSource, { destination: 'Output2', name: false }, 'Input8'],
		[FeedbackId.VideoSourceTally, { source: 'Input1', destination: 'Output5' }, true],
		[FeedbackId.AudioSource, { destination: 'Aux1', name: true }, 'No Source'],
	] as const)('%s with %o returns %s', (id, options, expected) => {
		const defs = setupCapture()
		expect(definition(defs, id).callback(info(id, 'fb-1', options), callbackContext)).toBe(expected)
	})
})

describe('feedback learn', () => {
	// As of API 2.0, learn returns only the learned keys, so an expression in any other option survives
	it.each([
		[FeedbackId.VideoSourceTally, { source: 'Input1' }],
		[FeedbackId.AudioSourceTally, { source: 'Input2' }],
	] as const)('%s returns only the routed source', async (id, expected) => {
		const { defs } = setup()
		const learned = await definition(defs, id).learn?.(
			info(id, 'fb-1', { source: 'Input9', destination: 'Output1' }),
			{} as CompanionFeedbackLearnContext,
		)
		expect(learned).toEqual(expected)
	})
})
