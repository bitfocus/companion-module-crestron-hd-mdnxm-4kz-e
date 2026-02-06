import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { StatusManager } from './status.js'
import { ApiCalls, type ApiCallValues, wsApiGetCalls } from './api.js'
import type { MsgData } from './types.js'
import { Crestron_HDMDNXM_4KZ } from './device.js'
import type { FeedbackSubscriptions } from './types.js'
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { throttle } from 'es-toolkit'
import { WebSocket } from 'ws'
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import { handleError } from './errors.js'
import PQueue from 'p-queue'
import url from 'node:url'

const PING_INTERVAL = 30000 // milliseconds

export class ModuleInstance extends InstanceBase<ModuleConfig, ModuleSecrets> {
	public crestronDevice!: Crestron_HDMDNXM_4KZ
	#config!: ModuleConfig // Setup in init()
	#secrets!: ModuleSecrets
	#CREST_XSRF_TOKEN: string = ''

	#axiosClient!: AxiosInstance
	#jar = new CookieJar()
	#socket: WebSocket | undefined
	#pingTimer: NodeJS.Timeout | undefined

	#queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	#controller = new AbortController()

	public statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)

	#feedbackIdsToCheck: Set<string> = new Set<string>()
	public feedbackSubscriptions: FeedbackSubscriptions = Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker()

	constructor(internal: unknown) {
		super(internal)
	}

	public debug(msg: string | object): void {
		if (this.#config.verbose) {
			if (typeof msg == 'object') msg = JSON.stringify(msg)
			this.log('debug', `${msg}`)
		}
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.#config = config
		this.#secrets = secrets

		this.configUpdated(config, secrets).catch(() => {})
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.debug(`destroy ${this.id}:${this.label}`)
		this.#controller.abort()
		this.#queue.clear()
		this.closeWebSocketConnection()
		this.statusManager.destroy()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.#queue.clear()

		this.#controller.abort()

		this.#config = config
		this.#secrets = secrets

		this.statusManager.updateStatus(InstanceStatus.Connecting)
		this.#controller = new AbortController()

		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = config.selfSigned ? '0' : '1'
		try {
			await this.createClient(config.host)
			await this.login()
			this.log('info', `Logged in to ${this.#config.host}`)
			const deviceQuery = await this.httpsGet(ApiCalls.Device)
			this.crestronDevice = Crestron_HDMDNXM_4KZ.createNewDevice(deviceQuery)
			this.createWebSocketConnection(config.host)
			this.throttledUpdateActionFeedbackDefs()
		} catch (err) {
			handleError(err, this)
			if (axios.isAxiosError(err)) {
				// Only attempt a reconnect if could not reach unit
				if (err.response === undefined) this.throttledReconnect()
			}
		}
	}

	throttledReconnect = throttle(
		() => {
			if (this.#controller.signal.aborted) return
			this.configUpdated(this.#config, this.#secrets).catch(() => {})
		},
		5000,
		{ edges: ['trailing'] },
	)

	private async createClient(host = this.#config.host): Promise<void> {
		if (!host) {
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		await this.#jar.removeAllCookies()
		this.#axiosClient = wrapper(axios.create({ baseURL: `https://${host}`, jar: this.#jar }))
	}

	private closeWebSocketConnection(): void {
		if (this.#socket) {
			this.#socket.removeAllListeners('open')
			this.#socket.removeAllListeners('message')
			this.#socket.removeAllListeners('close')
			this.#socket.removeAllListeners('error')
			this.#socket.terminate()
			this.#socket = undefined
		}
		if (this.#pingTimer) {
			clearTimeout(this.#pingTimer)
			this.#pingTimer = undefined
		}
	}

	private startWsPing(): void {
		if (this.#pingTimer) clearTimeout(this.#pingTimer)
		this.#pingTimer = setTimeout(() => this.sendWsPing(), PING_INTERVAL)
	}

	private sendWsPing(): void {
		if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
			// Keep a minimum of traffic on the socket so it doesnt go stale
			this.wsSend(wsApiGetCalls.routingMatrixRoutes, 0).catch(() => {})
		}
		this.startWsPing()
	}

	private createWebSocketConnection(host = this.#config.host): void {
		this.closeWebSocketConnection()
		this.throttledReconnect.cancel()

		if (!host) throw new Error('No host')

		const wsUrl = `wss://${this.#config.host}${ApiCalls.WsUpgrade}`
		this.debug(`Connecting to WebSocket at ${wsUrl}`)
		try {
			this.#socket = new WebSocket(wsUrl, {
				rejectUnauthorized: !this.#config.selfSigned,
				headers: {
					Cookie: this.#jar.getCookieStringSync(`https://${host}`),
					Upgrade: 'websocket',
					Connection: 'Upgrade',
					'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
					'Sec-WebSocket-Version': '13',
					'User-Agent': 'CompanionModuleClient/1.0',
					Origin: `https://${host}`,
					Referer: `https://${host}/userlogin.html`,
					'Accept-Encoding': 'gzip, deflate, br',
					'Accept-Language': 'en-US,en;q=0.9',
					'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
					'CREST-XSRF-TOKEN': this.#CREST_XSRF_TOKEN,
				},
			})
		} catch (err) {
			this.log('error', `Failed to create WebSocket: ${err instanceof Error ? err.message : 'Unknown error'}`)
			this.statusManager.updateStatus(InstanceStatus.UnknownError, 'WebSocket creation failed')
			this.throttledReconnect()
			return
		}

		this.#socket.addEventListener('open', () => {
			this.statusManager.updateStatus(InstanceStatus.Ok, `WebSocket connected`)
			this.log('info', `Connected to wss://${host}`)
			this.throttledReconnect.cancel()
			//Initial queries
			this.wsSend(wsApiGetCalls.avioV2).catch(() => {})
			this.wsSend(wsApiGetCalls.routingMatrix).catch(() => {})
		})
		this.#socket.addEventListener('message', (event) => {
			this.debug(
				`Message from websocket:\n${typeof event.data == 'object' ? JSON.stringify(event.data) : event.data.toString()}`,
			)
			try {
				const keys = this.crestronDevice.partialUpdateDeviceFromWebSocketMessage(event)
				keys.forEach((key) => {
					const feedbackIds = this.feedbackSubscriptions[key]
					if (feedbackIds) {
						feedbackIds.forEach((id) => this.#feedbackIdsToCheck.add(id))
					}
				})
				if (keys.includes('AvioV2')) {
					// Update action and feedback defs if AvioV2 changed
					this.throttledUpdateActionFeedbackDefs()
				}
				this.throttledCheckFeedbacksById()
			} catch (err) {
				handleError(err, this)
			}
		})
		this.#socket.addEventListener('error', (error) => {
			this.log('error', `Error from websocket: ${error.message}`)
			this.statusManager.updateStatus(InstanceStatus.UnknownError, error.message)
			this.throttledReconnect()
		})
		this.#socket.addEventListener('close', (event) => {
			this.log('warn', `Socket Closed. Code ${event.code}: ${event.reason}`)
			this.statusManager.updateStatus(InstanceStatus.Disconnected, `WebSocket disconnected`)
			this.#queue.clear()
			// Try and reinitalise connection in 5 seconds
			// Calls configUpdated, to redo the full auth and connection process
			this.throttledReconnect()
		})
	}

	public async httpsGet(path: ApiCallValues, priority: number = 0): Promise<AxiosResponse<any, any>> {
		return await this.#queue.add(
			async ({ signal }) => {
				if (!this.#axiosClient) throw new Error('Axios Client not initialised')
				return await this.#axiosClient.get(path, { signal }).then((response: AxiosResponse<any, any>) => {
					this.statusManager.updateStatus(InstanceStatus.Ok, response.statusText)
					this.debug(`Successful HTTPS Get from path: ${path}\nResponse data:`)
					this.debug(response.data)
					return response
				})
			},
			{ priority: priority, signal: this.#controller.signal },
		)
	}

	public async httpsPost(
		path: ApiCallValues,
		data: MsgData | undefined,
		headers: Record<string, string> = {},
		priority: number = 1,
	): Promise<AxiosResponse<any, any>> {
		return await this.#queue.add(
			async ({ signal }) => {
				if (!this.#axiosClient) throw new Error('Axios Client not initialised')
				if (this.#CREST_XSRF_TOKEN) headers[`CREST-XSRF-TOKEN`] = this.#CREST_XSRF_TOKEN
				const response = await this.#axiosClient
					.post(path, data, { headers: headers, signal: signal })
					.then((response: AxiosResponse<any, any>) => {
						if (
							response.headers['CREST-XSRF-TOKEN'] &&
							response.headers['CREST-XSRF-TOKEN'] !== this.#CREST_XSRF_TOKEN
						) {
							this.debug(`Updated XSRF Token: ${response.headers['CREST-XSRF-TOKEN']}`)
							this.#CREST_XSRF_TOKEN = response.headers['CREST-XSRF-TOKEN']
						}
						this.statusManager.updateStatus(InstanceStatus.Ok, response.statusText)
						this.debug(
							`Successful HTTPS Post to path: ${path} with post data ${typeof data == 'object' ? JSON.stringify(data) : typeof data == 'undefined' ? '' : data?.toString()}\nResponse data:`,
						)
						this.debug(response.data)
						return response
					})
				return response
			},
			{ priority: priority, signal: this.#controller.signal },
		)
	}

	public async wsSend(data: string, priority: number = 1): Promise<void> {
		return this.#queue.add(
			async ({ signal }) => {
				if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
					return new Promise<void>((resolve, reject) => {
						if (signal?.aborted) {
							reject(new Error(`Message send aborted: ${data}`))
							return
						}

						let settled = false

						const abortHandler = () => {
							if (!settled) {
								settled = true
								reject(new Error(`Message send aborted: ${data}`))
							}
						}
						signal?.addEventListener('abort', abortHandler)

						this.#socket?.send(data, (err) => {
							signal?.removeEventListener('abort', abortHandler)

							if (settled) return // Already rejected by abort
							settled = true

							if (err) {
								this.log('warn', `WebSocket failed to send ${data} with error ${err.message}`)
								handleError(err, this)
								reject(err)
							} else {
								this.debug(`Sent WebSocket Message: ${data}`)
								this.startWsPing()
								resolve()
							}
						})
					})
				} else {
					throw new Error(`WebSocket not open. Could not send ${data}`)
				}
			},
			{ priority: priority, signal: this.#controller.signal },
		)
	}

	private async login(): Promise<boolean> {
		this.#CREST_XSRF_TOKEN = ''
		const trackIdRequest = await this.httpsGet(ApiCalls.login, 3)
		this.debug(`Returned Headers: \n${JSON.stringify(trackIdRequest.headers)}`)
		this.debug(`Cookies: ${JSON.stringify(this.#jar.getCookiesSync(`https://${this.#config.host}`))}`)

		const params = new url.URLSearchParams()
		params.append('login', this.#config.user)
		params.append('passwd', this.#secrets.passwd)

		const loginRequest = await this.httpsPost(
			ApiCalls.login,
			params,
			{
				Origin: `https://${this.#config.host}`,
				Referer: `https://${this.#config.host}${ApiCalls.login}`,
				'Content-Type': `application/x-www-form-urlencoded`,
			},
			3,
		)
		this.debug(
			`Login request: ${JSON.stringify(loginRequest.statusText)}\n Returned Headers: \n${JSON.stringify(loginRequest.headers)}`,
		)
		return true
	}

	throttledCheckFeedbacksById = throttle(
		() => {
			if (this.#controller.signal.aborted) return
			if (this.#feedbackIdsToCheck.size === 0) return
			this.checkFeedbacksById(...Array.from(this.#feedbackIdsToCheck))
			this.#feedbackIdsToCheck.clear()
		},
		50,
		{ edges: ['trailing'] },
	)

	throttledUpdateActionFeedbackDefs = throttle(
		() => {
			if (this.#controller.signal.aborted) return
			this.updateActions() // export actions
			this.updateFeedbacks() // export feedbacks
			this.updateVariableDefinitions() // export variable definitions
		},
		5000,
		{ edges: ['trailing'] },
	)

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
