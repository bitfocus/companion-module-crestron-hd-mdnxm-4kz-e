import { describe, expect, it, vi } from 'vitest'
import type {
	CompanionActionCallbackContext,
	CompanionActionDefinitions,
	CompanionActionLearnContext,
} from '@companion-module/base'
import { ActionId, UpdateActions, autoRouteState, type ActionSchema } from '../actions.js'
import { wsApiPostCalls } from '../api.js'
import type ModuleInstance from '../main.js'
import type { AutoRouteState } from '../options.js'

function setup({ audioRouting = true, autoRoute = false } = {}) {
	const crestronDevice = {
		inputChoicesSupportingVideoRouting: [
			{ id: 'Input1', label: 'Input1: Camera' },
			{ id: 'Input2', label: 'Input2: Laptop' },
		],
		outputChoicesSupportingVideoRouting: [{ id: 'Output1', label: 'Output1: Screen' }],
		inputChoicesSupportingAudioRouting: audioRouting ? [{ id: 'Input2', label: 'Input2: Laptop' }] : [],
		outputChoicesSupportingAudioRouting: audioRouting ? [{ id: 'Output1', label: 'Output1: Screen' }] : [],
		routes: { Output1: { AudioSource: 'Input2', VideoSource: 'Input1' } },
		autoRoute,
	}
	const setActionDefinitions = vi.fn<(defs: CompanionActionDefinitions<ActionSchema>) => void>()
	const wsSend = vi.fn<(data: string, priority?: number, signal?: AbortSignal) => Promise<void>>(async () => {})
	const self = { crestronDevice, log: vi.fn(), setActionDefinitions, wsSend } as unknown as ModuleInstance
	UpdateActions(self)
	return { defs: setActionDefinitions.mock.calls[0][0], wsSend }
}

function defined<T>(def: T | false | undefined): T {
	if (!def) throw new Error('Action not defined')
	return def
}

const event = <TOptions>(actionId: ActionId, options: TOptions) => ({
	id: 'action-1',
	controlId: 'bank-1',
	actionId,
	options,
	surfaceId: undefined,
})

const learnContext = {} as CompanionActionLearnContext

describe('action definitions', () => {
	it('sets every action id, so Companion knows which ones this device lacks', () => {
		const { defs } = setup({ audioRouting: false })
		expect(Object.keys(defs).sort()).toEqual(Object.values(ActionId).sort())
	})

	it('offers Route Audio only when the device has audio routable inputs and outputs', () => {
		expect(setup({ audioRouting: false }).defs[ActionId.RouteAudio]).toBeUndefined()
		expect(setup({ audioRouting: true }).defs[ActionId.RouteAudio]).toBeTruthy()
	})
})

describe('action callbacks', () => {
	it('passes the action signal through to the send queue', async () => {
		const { defs, wsSend } = setup()
		const { signal } = new AbortController()
		const context = { signal } as CompanionActionCallbackContext

		await defined(defs[ActionId.RouteVideo]).callback(
			event(ActionId.RouteVideo, { source: 'Input2', destination: 'Output1', audio: true }),
			context,
		)
		await defined(defs[ActionId.ClearVideo]).callback(event(ActionId.ClearVideo, { destination: 'Output1' }), context)
		await defined(defs[ActionId.RouteAudio]).callback(
			event(ActionId.RouteAudio, { source: 'Input2', destination: 'Output1' }),
			context,
		)
		await defined(defs[ActionId.AutoRoute]).callback(event(ActionId.AutoRoute, { enable: 'on' }), context)

		expect(wsSend.mock.calls).toEqual([
			[wsApiPostCalls.routeAudioVideo('Output1', 'Input2'), 1, signal],
			[wsApiPostCalls.clearRoute('Output1'), 1, signal],
			[wsApiPostCalls.routeAudio('Output1', 'Input2'), 1, signal],
			[wsApiPostCalls.autoRoute(true), 1, signal],
		])
	})

	it('refuses to route without a destination, rather than sending one keyed "undefined"', async () => {
		const { defs, wsSend } = setup()
		const options = { source: 'Input1', audio: true } as unknown as ActionSchema[ActionId.RouteVideo]['options']
		await expect(
			defined(defs[ActionId.RouteVideo]).callback(event(ActionId.RouteVideo, options), {
				signal: new AbortController().signal,
			} as CompanionActionCallbackContext),
		).rejects.toThrow('Source or Destination not set')
		expect(wsSend).not.toHaveBeenCalled()
	})
})

describe('action learn', () => {
	// As of API 2.0, learn returns only the learned keys, so an expression in any other option survives
	it('returns only the routed video source', async () => {
		const { defs } = setup()
		const learned = await defined(defs[ActionId.RouteVideo]).learn?.(
			event(ActionId.RouteVideo, { source: 'Input2', destination: 'Output1', audio: false }),
			learnContext,
		)
		expect(learned).toEqual({ source: 'Input1' })
	})

	it('returns only the routed audio source', async () => {
		const { defs } = setup()
		const learned = await defined(defs[ActionId.RouteAudio]).learn?.(
			event(ActionId.RouteAudio, { source: 'Input1', destination: 'Output1' }),
			learnContext,
		)
		expect(learned).toEqual({ source: 'Input2' })
	})

	it('learns nothing for a destination with no route', async () => {
		const { defs } = setup()
		const learned = await defined(defs[ActionId.RouteVideo]).learn?.(
			event(ActionId.RouteVideo, { source: 'Input1', destination: 'Output9', audio: false }),
			learnContext,
		)
		expect(learned).toBeUndefined()
	})
})

describe('autoRouteState', () => {
	it.each([
		['on', false, true],
		['on', true, true],
		['off', false, false],
		['off', true, false],
		['toggle', false, true],
		['toggle', true, false],
	] as const)('%s with auto route %s sends %s', (enable, current, expected) => {
		expect(autoRouteState(enable, current)).toBe(expected)
	})

	it('toggles for a saved value this version no longer offers', () => {
		expect(autoRouteState('bogus' as AutoRouteState, true)).toBe(false)
	})
})
