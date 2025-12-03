import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { StatusManager } from './status.js'
import { ApiCalls, type ApiCallValues } from './api.js'
import { HttpStatusCodes } from './errors.js'
import type { MsgData } from './types.js'
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import { WebSocket } from 'ws'
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import PQueue from 'p-queue'
import url from 'node:url'

const PING_INTERVAL = 30000 // milliseconds

export class ModuleInstance extends InstanceBase<ModuleConfig, ModuleSecrets> {
	#config!: ModuleConfig // Setup in init()
	#secrets!: ModuleSecrets
	#axiosClient!: AxiosInstance
	#socket!: WebSocket
	#pingTimer: NodeJS.Timeout | undefined
	#jar = new CookieJar()
	#queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	#controller = new AbortController()
	#statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	#CREST_XSRF_TOKEN: string = ''

	constructor(internal: unknown) {
		super(internal)
	}

	public debug(msg: string | object): void {
		if (this.#config.verbose) {
			if (typeof msg == 'object') msg = JSON.stringify(msg)
			this.log('debug', `[${new Date().toJSON()}] ${msg}`)
		}
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.#config = config
		this.#secrets = secrets
		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions

		this.configUpdated(config, secrets).catch(() => {})
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.debug(`destroy ${this.id}:${this.label}`)
		await this.logout()
		this.#statusManager.destroy()
		this.#controller.abort()
		this.#queue.clear()
		this.closeWebSocketConnection()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.debug(config)
		this.debug(secrets)
		this.#controller.abort()
		this.#config = config
		this.#secrets = secrets
		this.#statusManager.updateStatus(InstanceStatus.Connecting)
		this.#controller = new AbortController()
		this.#queue.clear()
		process.title = this.label
		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = config.selfSigned ? '0' : '1'
		await this.createClient(config.host)
		if (await this.login()) {
			this.log('info', `Logged in to ${this.#config.host}`)
			this.createWebSocketConnection(config.host)
		} else {
			this.#statusManager.updateStatus(InstanceStatus.BadConfig, `Can't login`)
		}
	}

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
			this.#socket.close(1000, 'Resetting connection')
			this.#socket.removeEventListener('open', () => {})
			this.#socket.removeEventListener('message', () => {})
			this.#socket.removeEventListener('close', () => {})
			this.#socket.removeEventListener('error', () => {})
		}
		if (this.#pingTimer) {
			clearTimeout(this.#pingTimer)
			this.#pingTimer = undefined
		}
	}

	private sendWsPing(): void {
		if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
			this.debug('Sending WebSocket Ping')
			this.#socket.ping()
		}
		this.#pingTimer = setTimeout(() => this.sendWsPing(), PING_INTERVAL)
	}

	private createWebSocketConnection(host = this.#config.host): void {
		this.closeWebSocketConnection()
		if (!host) {
			this.#statusManager.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
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
			this.sendWsPing()
		})
		this.#socket.addEventListener('message', (event) => {
			this.debug(`Message from websocket:\n${JSON.stringify(event.data)}`)
		})
		this.#socket.addEventListener('error', (error) => {
			this.log('error', `Error from websocket: ${error.message}`)
			this.#statusManager.updateStatus(InstanceStatus.UnknownError, error.message)
		})
		this.#socket.addEventListener('close', (event) => {
			this.log('warn', `Socket Closed. Code ${event.code}: ${event.reason}`)
			this.#statusManager.updateStatus(InstanceStatus.Disconnected, `WebSocket disconnected`)
			this.#queue.clear()
		})
	}

	public async get(path: ApiCallValues): Promise<AxiosResponse<any, any> | AxiosError<unknown, any>> {
		return await this.#queue.add(
			async () => {
				return await this.#axiosClient
					.get(path)
					.then((response: AxiosResponse<any, any>) => {
						this.#statusManager.updateStatus(InstanceStatus.Ok, response.statusText)
						return response
					})
					.catch((error: AxiosError) => {
						this.#statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
						this.log('error', String(error.cause))
						return error
					})
			},
			{ signal: this.#controller.signal },
		)
	}

	public async post(
		path: ApiCallValues,
		data: MsgData | undefined,
		headers: Record<string, string> = {},
	): Promise<AxiosResponse<any, any> | AxiosError<unknown, any>> {
		return await this.#queue.add(
			async () => {
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
						return response
					})
					.catch((error: AxiosError) => {
						let status: InstanceStatus = InstanceStatus.UnknownError
						if (error.status && error.status in HttpStatusCodes)
							status = HttpStatusCodes[error.status as keyof typeof HttpStatusCodes]
						this.#statusManager.updateStatus(status, error.code)
						this.log('error', JSON.stringify(error))
						return error
					})
				return response
			},
			{ signal: this.#controller.signal },
		)
	}

	private async login(): Promise<boolean> {
		try {
			this.#CREST_XSRF_TOKEN = ''
			const trackIdRequest = await this.get(ApiCalls.login)
			if (trackIdRequest instanceof AxiosError) throw trackIdRequest
			this.debug(`Returned Headers: \n${JSON.stringify(trackIdRequest.headers)}`)
			this.debug(`Cookies: ${JSON.stringify(this.#jar.getCookiesSync(`https://${this.#config.host}`))}`)

			const params = new url.URLSearchParams()
			params.append('login', this.#config.user)
			params.append('passwd', this.#secrets.passwd)
			//this.debug(params.toString())
			const loginRequest = await this.post(ApiCalls.login, params, {
				Origin: `https://${this.#config.host}`,
				Referer: `https://${this.#config.host}${ApiCalls.login}`,
				'Content-Type': `application/x-www-form-urlencoded`,
			})
			if (loginRequest instanceof AxiosError) throw loginRequest
			this.debug(
				`Login request: ${JSON.stringify(loginRequest.statusText)}\n Returned Headers: \n${JSON.stringify(loginRequest.headers)}`,
			)
			return true
		} catch (err: any) {
			this.log('error', JSON.stringify(err))
			return false
		}
	}

	private async logout(): Promise<void> {
		try {
			this.closeWebSocketConnection()
			await this.get(ApiCalls.logout)
			await this.#jar.removeAllCookies()
		} catch (err: any) {
			this.log('warn', `Logout failed ${err}`)
		}
	}

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
