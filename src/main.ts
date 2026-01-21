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
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import { throttle } from 'es-toolkit'
import { WebSocket } from 'ws'
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import { ZodError } from 'zod'
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
	#socket!: WebSocket
	#pingTimer: NodeJS.Timeout | undefined

	#queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	#controller = new AbortController()

	#statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)

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
		this.#queue.clear()
		this.closeWebSocketConnection()
		await this.logout()

		this.#controller.abort()
		this.#statusManager.destroy()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.#queue.clear()
		this.#controller.abort()

		this.#config = config
		this.#secrets = secrets

		this.#statusManager.updateStatus(InstanceStatus.Connecting)
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
			this.handleError(err)
			if (axios.isAxiosError(err)) {
				// Only attempt a reconnect if could not reach unit
				if (err.response === undefined) this.throttledReconnect()
			}
		}
	}

	throttledReconnect = throttle(
		() => {
			this.configUpdated(this.#config, this.#secrets).catch(() => {})
		},
		5000,
		{ edges: ['trailing'], signal: this.#controller.signal },
	)

	private async createClient(host = this.#config.host): Promise<void> {
		if (!host) {
			this.#statusManager.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		await this.#jar.removeAllCookies()
		this.#axiosClient = wrapper(
			axios.create({ baseURL: `https://${host}`, signal: this.#controller.signal, jar: this.#jar }),
		)
	}

	private closeWebSocketConnection(): void {
		if (this.#socket) {
			this.#socket.terminate()
			//this.#socket.close(1000, 'Resetting connection')
			this.#socket.removeAllListeners('open')
			this.#socket.removeAllListeners('message')
			this.#socket.removeAllListeners('close')
			this.#socket.removeAllListeners('error')
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
		if (!host) throw new Error('No host')
		const wsUrl = `wss://${this.#config.host}${ApiCalls.WsUpgrade}`
		this.debug(`Connecting to WebSocket at ${wsUrl}`)
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
		this.#socket.addEventListener('open', () => {
			this.updateStatus(InstanceStatus.Ok, `WebSocket connected`)
			this.log('info', `Connected to wss://${host}`)

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
				this.handleError(err)
			}
		})
		this.#socket.addEventListener('error', (error) => {
			this.log('error', `Error from websocket: ${error.message}`)
			this.#statusManager.updateStatus(InstanceStatus.UnknownError, error.message)
		})
		this.#socket.addEventListener('close', (event) => {
			this.log('warn', `Socket Closed. Code ${event.code}: ${event.reason}`)
			this.#statusManager.updateStatus(InstanceStatus.Disconnected, `WebSocket disconnected`)
			this.#queue.clear()
			// Try and reinitalise connection in 5 seconds
			// Calls configUpdated, to redo the full auth and connection process
			this.throttledReconnect()
		})
	}

	public async httpsGet(path: ApiCallValues, priority: number = 0): Promise<AxiosResponse<any, any>> {
		return await this.#queue.add(
			async () => {
				if (!this.#axiosClient) throw new Error('Axios Client not initialised')
				return await this.#axiosClient.get(path).then((response: AxiosResponse<any, any>) => {
					this.#statusManager.updateStatus(InstanceStatus.Ok, response.statusText)
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
			async () => {
				if (!this.#axiosClient) throw new Error('Axios Client not initialised')
				if (this.#CREST_XSRF_TOKEN) headers[`CREST-XSRF-TOKEN`] = this.#CREST_XSRF_TOKEN
				const response = await this.#axiosClient
					.post(path, data, { headers: headers })
					.then((response: AxiosResponse<any, any>) => {
						if (
							response.headers['CREST-XSRF-TOKEN'] &&
							response.headers['CREST-XSRF-TOKEN'] !== this.#CREST_XSRF_TOKEN
						) {
							this.debug(`Updated XSRF Token: ${response.headers['CREST-XSRF-TOKEN']}`)
							this.#CREST_XSRF_TOKEN = response.headers['CREST-XSRF-TOKEN']
						}
						this.#statusManager.updateStatus(InstanceStatus.Ok, response.statusText)
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
			async () => {
				if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
					return new Promise<void>((resolve, reject) => {
						this.#socket.send(data, (err) => {
							if (err) {
								this.log('warn', `WebSocket failed to send ${data} with error ${err.message}`)
								this.handleError(err)
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

	private async logout(): Promise<void> {
		try {
			this.closeWebSocketConnection()
			await this.httpsGet(ApiCalls.logout, 2)
			await this.#jar.removeAllCookies()
		} catch (err: unknown) {
			this.log('warn', `Logout failed`)
			this.handleError(err)
		}
	}

	public handleError(err: unknown): void {
		if (axios.isAxiosError(err)) {
			this.#handleAxiosError(err)
		} else if (err instanceof ZodError) {
			this.#handleZodError(err)
		} else {
			this.#handleUnknownError(err)
		}
	}

	#handleAxiosError(err: AxiosError): void {
		this.debug(err)

		if (err.response) {
			// Server responded with error status (4xx, 5xx)
			this.#handleHttpError(err)
		} else if (err.request) {
			// Request sent but no response received (network/timeout issues)
			this.#handleNetworkError(err)
		} else {
			// Error during request setup
			this.#statusManager.updateStatus(InstanceStatus.UnknownError)
			this.log('error', `Request setup error: ${err.message}`)
		}
	}

	#handleHttpError(err: AxiosError): void {
		const status = err.response?.status

		// Set status based on HTTP response code
		if (status && status >= 500) {
			this.#statusManager.updateStatus(InstanceStatus.UnknownError)
			this.log('error', `Server error ${status}: ${err.message}`)
		} else if (status === 401 || status === 403) {
			this.#statusManager.updateStatus(InstanceStatus.AuthenticationFailure)
			this.log('error', `Authentication error ${status}: Check credentials`)
		} else if (status === 404) {
			this.#statusManager.updateStatus(InstanceStatus.UnknownWarning)
			this.log('error', `Not found ${status}: Endpoint may have changed`)
		} else if (status === 429) {
			this.#statusManager.updateStatus(InstanceStatus.UnknownWarning)
			this.log('error', `Rate limited ${status}: Too many requests`)
		} else {
			this.#statusManager.updateStatus(InstanceStatus.UnknownWarning)
			this.log('error', `HTTP ${status}: ${err.message}`)
		}

		// Log response data if useful
		if (err.response?.data && typeof err.response.data === 'string') {
			this.log('error', `Response: ${err.response.data}`)
		}
	}

	#handleNetworkError(err: AxiosError): void {
		const code = err.code

		switch (code) {
			case 'ECONNREFUSED':
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', 'Connection refused: Device may be offline or unreachable')
				break

			case 'ETIMEDOUT':
			case 'ECONNABORTED':
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', `Request timed out: Device not responding (${code})`)
				break

			case 'ENOTFOUND':
			case 'EAI_AGAIN':
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', `DNS resolution failed: Cannot find device hostname (${code})`)
				break

			case 'ENETUNREACH':
			case 'EHOSTUNREACH':
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', `Network unreachable: Check network connectivity (${code})`)
				break

			case 'ECONNRESET':
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', 'Connection reset: Device closed connection unexpectedly')
				break

			case 'EPIPE':
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', 'Broken pipe: Connection lost during transmission')
				break

			case 'ECANCELED':
				// Request was cancelled (e.g., by AbortController)
				this.log('warn', 'Request cancelled')
				// Don't change status for cancellations
				break

			case 'ERR_NETWORK':
				// Generic network error (often seen in browsers)
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', 'Network error: Check device connection')
				break

			case 'ERR_BAD_REQUEST':
				// Request was malformed
				this.#statusManager.updateStatus(InstanceStatus.UnknownError)
				this.log('error', `Bad request: ${err.message}`)
				break

			case 'ERR_BAD_RESPONSE':
				// Response was malformed
				this.#statusManager.updateStatus(InstanceStatus.UnknownWarning)
				this.log('error', `Invalid response from device: ${err.message}`)
				break

			default:
				// Unknown network error
				this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure)
				this.log('error', `Network error${code ? ` (${code})` : ''}: ${err.message}`)
				break
		}

		// Additional context
		if (err.config?.url) {
			this.log('debug', `Failed URL: ${err.config.url}`)
		}
	}

	#handleZodError(err: ZodError): void {
		this.debug(err)

		// Format Zod errors more readably
		const formattedErrors = err.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n  ')

		this.log('warn', `Invalid data returned:\n  ${formattedErrors}`)
	}

	#handleUnknownError(err: unknown): void {
		this.#statusManager.updateStatus(InstanceStatus.UnknownError)

		// Safely stringify unknown errors
		const errorMessage =
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			err instanceof Error ? err.message : typeof err == 'object' ? JSON.stringify(err) : String(err)

		this.log('error', `Unknown error: ${errorMessage}`)

		// Log stack trace if available
		if (err instanceof Error && err.stack) {
			this.debug(err.stack)
		}
	}

	throttledCheckFeedbacksById = throttle(
		() => {
			if (this.#feedbackIdsToCheck.size === 0) return
			this.checkFeedbacksById(...Array.from(this.#feedbackIdsToCheck))
			this.#feedbackIdsToCheck.clear()
		},
		50,
		{ edges: ['trailing'], signal: this.#controller.signal },
	)

	throttledUpdateActionFeedbackDefs = throttle(
		() => {
			this.updateActions() // export actions
			this.updateFeedbacks() // export feedbacks
			this.updateVariableDefinitions() // export variable definitions
		},
		5000,
		{ edges: ['trailing'], signal: this.#controller.signal },
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
