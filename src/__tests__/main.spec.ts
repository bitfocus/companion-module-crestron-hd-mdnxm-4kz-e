import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Main from '../main.js'
import ModuleInstance from '../main.js'
import { UpgradeScripts } from '../upgrades.js'

// Enough of InstanceBase to construct the module without a Companion host
vi.mock('@companion-module/base', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@companion-module/base')>()
	class InstanceBase {
		constructor(_internal: unknown) {}
		log(): void {}
		updateStatus(): void {}
		checkFeedbacksById(): void {}
		checkAllFeedbacks(): void {}
		setActionDefinitions(): void {}
		setFeedbackDefinitions(): void {}
		setVariableDefinitions(): void {}
	}
	return { ...actual, InstanceBase }
})

afterEach(() => {
	vi.useRealTimers()
})

describe('entry point', () => {
	// API 2.x has no runEntrypoint: Companion loads the default export and the named UpgradeScripts
	it('exports the instance class as default and the upgrade scripts by name', () => {
		expect(Main.default).toBe(ModuleInstance)
		expect(Main.UpgradeScripts).toBe(UpgradeScripts)
	})
})

describe('wsSend', () => {
	it('drops a message whose action signal has aborted, before it reaches the socket', async () => {
		const instance = new ModuleInstance({})
		const controller = new AbortController()
		const reason = new Error('user aborted the running actions')
		controller.abort(reason)

		// No socket is open, so a message the queue ran would fail with "WebSocket not open" instead
		await expect(instance.wsSend('{}', 1, controller.signal)).rejects.toBe(reason)
	})
})

describe('throttledUpdateActionFeedbackDefs', () => {
	// Feedbacks register for WebSocket updates from their callbacks, as API 2.x has no subscribe hook
	it('runs every feedback callback once the new definitions are set', async () => {
		vi.useFakeTimers()
		const instance = new ModuleInstance({})
		const updateFeedbacks = vi.spyOn(instance, 'updateFeedbacks').mockImplementation(() => {})
		vi.spyOn(instance, 'updateActions').mockImplementation(() => {})
		vi.spyOn(instance, 'updateVariableDefinitions').mockImplementation(() => {})
		const checkAllFeedbacks = vi.spyOn(instance, 'checkAllFeedbacks')

		instance.throttledUpdateActionFeedbackDefs()
		await vi.advanceTimersByTimeAsync(5000)

		expect(checkAllFeedbacks).toHaveBeenCalledTimes(1)
		expect(checkAllFeedbacks.mock.invocationCallOrder[0]).toBeGreaterThan(updateFeedbacks.mock.invocationCallOrder[0])
	})
})
