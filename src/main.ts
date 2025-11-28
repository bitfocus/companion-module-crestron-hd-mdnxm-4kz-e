import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { StatusManager } from './status.js'
import { ApiCalls, type ApiCallValues } from './api.js'
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import { CookieJar } from 'tough-cookie'
import { wrapper } from 'axios-cookiejar-support'
import PQueue from 'p-queue'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	private config!: ModuleConfig // Setup in init()
	private axiosClient!: AxiosInstance
	private jar = new CookieJar()
	private queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	private controller = new AbortController()
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)
	private CREST_XSRF_TOKEN: string = ''

	constructor(internal: unknown) {
		super(internal)
	}

	public debug(msg: string | object): void {
		//this.cpuUsage = process.cpuUsage(this.cpuUsage)
		if (this.config.verbose) {
			if (typeof msg == 'object') msg = JSON.stringify(msg)
			this.log('debug', `[${new Date().toJSON()}] ${msg}`)
		}
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions

		this.configUpdated(config).catch(() => {})
	}
	// When module gets deleted
	async destroy(): Promise<void> {
		this.debug(`destroy ${this.id}:${this.label}`)
		await this.logout()
		this.statusManager.destroy()
		this.controller.abort()
		this.queue.clear()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.controller.abort()
		this.config = config
		process.title = this.label

		this.statusManager.updateStatus(InstanceStatus.Connecting)
		this.controller = new AbortController()
		this.queue.clear()
		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = config.selfSigned ? '0' : '1'
		await this.createClient(config.host)
		if (await this.login()) {
			this.log('info', `Logged in to ${this.config.host}`)
		} else {
			this.statusManager.updateStatus(InstanceStatus.BadConfig, `Can't login`)
		}
	}

	private async createClient(host = this.config.host): Promise<void> {
		if (!host) {
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		await this.jar.removeAllCookies()
		this.axiosClient = wrapper(
			axios.create({ baseURL: `https://${host}`, signal: this.controller.signal, jar: this.jar }),
		)
	}

	public async get(path: ApiCallValues): Promise<AxiosResponse<any, any> | AxiosError<unknown, any>> {
		return await this.queue.add(async () => {
			return await this.axiosClient
				.get(path)
				.then((response: AxiosResponse<any, any>) => {
					this.statusManager.updateStatus(InstanceStatus.Ok)
					return response
				})
				.catch((error: AxiosError) => {
					this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
					this.log('error', String(error.cause))
					return error
				})
		})
	}

	public async post(
		path: ApiCallValues,
		data: string | undefined,
		headers: Record<string, string> = {},
	): Promise<AxiosResponse<any, any> | AxiosError<unknown, any>> {
		return await this.queue.add(async () => {
			if (this.CREST_XSRF_TOKEN) headers[`CREST-XSRF-TOKEN`] = this.CREST_XSRF_TOKEN
			return await this.axiosClient
				.post(path, data, { headers: headers })
				.then((response: AxiosResponse<any, any>) => {
					this.statusManager.updateStatus(InstanceStatus.Ok)
					return response
				})
				.catch((error: AxiosError) => {
					this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
					this.log('error', JSON.stringify(error))
					return error
				})
		})
	}

	private async login(): Promise<boolean> {
		try {
			const trackIdRequest = await this.get(ApiCalls.login)
			if (trackIdRequest instanceof AxiosError) throw trackIdRequest
			this.debug(`Returned Headers: \n${JSON.stringify(trackIdRequest.headers)}`)
			this.debug(`Cookies: ${JSON.stringify(this.jar.getCookiesSync(`https://${this.config.host}`))}`)
			const loginRequest = await this.post(
				ApiCalls.login,
				`login=${this.config.user}&&passwd=${this.config.passwd}\r\n`,
				{
					Origin: `https://${this.config.host}`,
					Referer: `https://${this.config.host}${ApiCalls.login}`,
					'Content-Type': `text/plain`,
				},
			)
			this.debug(`Login request: ${JSON.stringify(loginRequest)}`)
			console.log(loginRequest)
			return true
		} catch (err: any) {
			this.log('error', JSON.stringify(err))
			return false
		}
	}

	private async logout(): Promise<void> {
		try {
			await this.get(ApiCalls.logout)
			await this.jar.removeAllCookies()
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
