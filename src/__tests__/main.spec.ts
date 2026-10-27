import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { EventEmitter } from 'node:events'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { InstanceStatus } from '@companion-module/base'
import * as Main from '../main.js'
import ModuleInstance from '../main.js'
import { UpgradeScripts } from '../upgrades.js'
import { ApiCalls } from '../api.js'
import type { ModuleConfig, ModuleSecrets } from '../config.js'
import type { StatusManager } from '../status.js'
import { makeDeviceData } from './fixtures.js'

interface FakeSocket extends EventEmitter {
	readyState: number
	open(): void
}

type Reply = () => Promise<unknown>

/** The fake device: the WebSockets the module opened, the requests it made, and what it answers */
const device = vi.hoisted(() => ({
	sockets: [] as FakeSocket[],
	/** Scripted replies per `METHOD path`, used in order. Once used up, the device answers normally */
	replies: new Map<string, Reply[]>(),
	requests: [] as string[],
}))

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

vi.mock('axios-cookiejar-support', () => ({
	wrapper: () => {
		const request = async (method: string, path: string): Promise<unknown> => {
			device.requests.push(`${method} ${path}`)
			const scripted = device.replies.get(`${method} ${path}`)?.shift()
			if (scripted) return await scripted()
			return path === ApiCalls.Device ? ok(makeDeviceData()) : ok()
		}
		return {
			get: async (path: string) => await request('GET', path),
			post: async (path: string) => await request('POST', path),
		}
	},
}))

vi.mock('ws', async () => {
	const { EventEmitter } = await import('node:events')
	class WebSocket extends EventEmitter {
		static OPEN = 1
		readyState = 0
		send = vi.fn((_data: string, cb: (err?: Error) => void) => cb())
		terminate = vi.fn()
		constructor() {
			super()
			device.sockets.push(this)
		}
		addEventListener(type: string, listener: (...args: unknown[]) => void): void {
			this.on(type, listener)
		}
		open(): void {
			this.readyState = 1
			this.emit('open')
		}
	}
	return { WebSocket }
})

function ok(data: unknown = '', headers: Record<string, string | string[]> = {}) {
	return { data, status: 200, statusText: 'OK', headers: new AxiosHeaders(headers) }
}

function httpError(status: number): AxiosError {
	const response = { data: '', status, statusText: '', headers: new AxiosHeaders(), config: {} } as AxiosResponse
	return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', undefined, {}, response)
}

/** The request went out but nothing came back, as when the device is unreachable */
const noResponse = (): AxiosError => new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', undefined, {})

/** A request the device accepts but never answers */
const hang: Reply = async () => await new Promise(() => {})

function reply(method: 'GET' | 'POST', path: string, ...replies: Reply[]): void {
	device.replies.set(`${method} ${path}`, replies)
}

/** Each connection attempt starts by fetching the login page */
const attempts = (): number => device.requests.filter((r) => r === `GET ${ApiCalls.login}`).length
const logins = (): number => device.requests.filter((r) => r === `POST ${ApiCalls.login}`).length

const CONFIG: ModuleConfig = { host: '192.0.2.1', user: 'companion', selfSigned: false, verbose: false }
const SECRETS: ModuleSecrets = { passwd: 'secret' }

/** Enough time for one connection attempt to get through the request queue, which runs one request per 50ms */
const ATTEMPT = 500
/** The delay before a failed attempt is retried */
const RETRY = 5000

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

describe('connection', () => {
	let instance: ModuleInstance
	let updateStatus: MockInstance<StatusManager['updateStatus']>

	beforeEach(() => {
		vi.useFakeTimers()
		device.sockets.length = 0
		device.requests.length = 0
		device.replies.clear()
		instance = new ModuleInstance({})
		updateStatus = vi.spyOn(instance.statusManager, 'updateStatus')
	})
	afterEach(async () => {
		await instance.destroy()
	})

	async function start(config: ModuleConfig = CONFIG): Promise<void> {
		await instance.init(config, true, SECRETS)
		await vi.advanceTimersByTimeAsync(ATTEMPT)
	}

	describe('before the credentials are sent', () => {
		// The login page used to be retried only if it got no response at all. An error status from it, as a
		// device can give while it boots, ended the retries for good
		it.each([503, 500, 404, 401])('retries when the login page answers %i', async (status) => {
			reply('GET', ApiCalls.login, async () => await Promise.reject(httpError(status)))
			await start()
			expect(device.sockets).toHaveLength(0)

			await vi.advanceTimersByTimeAsync(RETRY + ATTEMPT)
			expect(attempts()).toBe(2)
			expect(logins()).toBe(1)
			expect(device.sockets).toHaveLength(1)
		})

		it('sends the credentials only once the login page has loaded', async () => {
			reply('GET', ApiCalls.login, ...Array.from({ length: 5 }, () => async () => await Promise.reject(httpError(503))))
			await start()
			await vi.advanceTimersByTimeAsync(5 * (RETRY + ATTEMPT))
			expect(attempts()).toBe(6)
			expect(logins()).toBe(1)
		})
	})

	describe('once the credentials are sent, exactly as before', () => {
		// Any response from here on could be the device rejecting the credentials, and retrying those would count
		// towards its lockouts. The API docs aren't reliable enough to say which responses are safe
		it.each([
			['the login', 'POST', ApiCalls.login, () => httpError(503)],
			['the login', 'POST', ApiCalls.login, () => httpError(401)],
			['the device query', 'GET', ApiCalls.Device, () => httpError(503)],
			['the device query', 'GET', ApiCalls.Device, () => httpError(403)],
		] as const)('does not retry when %s answers with an error', async (_stage, method, path, error) => {
			reply(method, path, async () => await Promise.reject(error()))
			await start()

			await vi.advanceTimersByTimeAsync(60000)
			expect(attempts()).toBe(1)
			expect(logins()).toBe(1)
		})

		it('does not retry when the device data fails the schema', async () => {
			reply('GET', ApiCalls.Device, async () => ok({ Device: {} }))
			await start()

			await vi.advanceTimersByTimeAsync(60000)
			expect(attempts()).toBe(1)
		})

		it.each([
			['the login', 'POST', ApiCalls.login],
			['the device query', 'GET', ApiCalls.Device],
		] as const)('retries when %s gets no response at all', async (_stage, method, path) => {
			reply(method, path, async () => await Promise.reject(noResponse()))
			await start()

			await vi.advanceTimersByTimeAsync(RETRY + ATTEMPT)
			expect(attempts()).toBe(2)
			expect(device.sockets).toHaveLength(1)
		})
	})

	it('does not retry without a host', async () => {
		await start({ ...CONFIG, host: '' })

		await vi.advanceTimersByTimeAsync(60000)
		expect(attempts()).toBe(0)
		expect(updateStatus).toHaveBeenCalledWith(InstanceStatus.BadConfig, 'No host')
	})

	it('does not let an attempt superseded by a config update schedule a retry of its own', async () => {
		reply('GET', ApiCalls.login, hang)
		// The new attempt takes longer than the retry delay, so a stray retry would start a third attempt alongside it
		reply(
			'GET',
			ApiCalls.Device,
			async () => await new Promise((resolve) => setTimeout(() => resolve(ok(makeDeviceData())), 8000)),
		)
		await start()

		const updated = instance.configUpdated(CONFIG, SECRETS)
		await vi.advanceTimersByTimeAsync(30000)
		await updated
		expect(attempts()).toBe(2)
		expect(device.sockets).toHaveLength(1)
	})

	describe('status', () => {
		// Each successful request used to set OK, so a failed attempt could show OK while not connected
		it('shows OK only once the WebSocket opens', async () => {
			await start()
			expect(updateStatus).not.toHaveBeenCalledWith(InstanceStatus.Ok, expect.anything())

			device.sockets[0].open()
			expect(updateStatus).toHaveBeenLastCalledWith(InstanceStatus.Ok, 'WebSocket connected')
		})

		it('shows an error when the device data fails the schema', async () => {
			reply('GET', ApiCalls.Device, async () => ok({ Device: {} }))
			await start()
			expect(updateStatus).toHaveBeenLastCalledWith(InstanceStatus.UnknownError, 'Connection failed')
		})
	})

	describe('logging', () => {
		// The verbose log from a user on 2026-10-27 held the unit's session cookies and its 802.1X password
		it('keeps session cookies, the password and unparsed device settings out of the verbose log', async () => {
			reply('GET', ApiCalls.login, async () => ok('<html>', { 'set-cookie': ['TRACKID=trackid-value; Path=/'] }))
			reply('POST', ApiCalls.login, async () => ok('', { 'set-cookie': ['userid=userid-value;Path=/;Secure'] }))
			reply('GET', ApiCalls.Device, async () =>
				ok({ Device: { ...makeDeviceData().Device, Ieee8021x: { Password: 'dot1x-value' } } }),
			)
			const log = vi.spyOn(instance, 'log')
			await instance.init({ ...CONFIG, verbose: true }, true, { passwd: 'login-password-value' })
			await vi.advanceTimersByTimeAsync(ATTEMPT)

			const logged = JSON.stringify(log.mock.calls)
			expect(logged).toContain('Successful HTTPS Get from path: /Device')
			expect(logged).toContain('userid=<redacted>')
			for (const secret of ['trackid-value', 'userid-value', 'login-password-value', 'dot1x-value']) {
				expect(logged).not.toContain(secret)
			}
		})

		it('says a WebSocket message that fails the schema was ignored', async () => {
			const log = vi.spyOn(instance, 'log')
			await start()
			device.sockets[0].open()
			device.sockets[0].emit('message', {
				data: JSON.stringify({ Device: { AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: 'yes' } } }),
			})
			expect(log).toHaveBeenCalledWith(
				'warn',
				'Invalid data from device (WebSocket message, update ignored):\n  Device.AvMatrixRoutingV2.IsAutomaticRoutingEnabled: Invalid input: expected boolean, received string (value "yes")',
			)
		})
	})
})
