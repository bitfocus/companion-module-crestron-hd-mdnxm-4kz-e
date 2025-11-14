import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { StatusManager } from './status.js'
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios'
import PQueue from 'p-queue'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	private config!: ModuleConfig // Setup in init()
	private axiosClient!: AxiosInstance
	private queue = new PQueue({ concurrency: 1, interval: 50, intervalCap: 1 })
	private controller = new AbortController()
	private statusManager = new StatusManager(this, { status: InstanceStatus.Connecting, message: 'Initialising' }, 2000)

	constructor(internal: unknown) {
		super(internal)
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
		this.log('debug', 'destroy')
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
		this.createClient(config.host)
	}

	private createClient(host = this.config.host): void {
		if (!host) {
			this.statusManager.updateStatus(InstanceStatus.BadConfig, 'No host')
			return
		}
		this.axiosClient = axios.create({ baseURL: `https://${host}`, signal: this.controller.signal })
	}

	public async get(path: string): Promise<AxiosResponse<any, any> | AxiosError<unknown, any>> {
		return await this.queue.add(async () => {
			return await this.axiosClient
				.get(path)
				.then((response: AxiosResponse<any, any>) => {
					this.statusManager.updateStatus(InstanceStatus.Ok)
					return response
				})
				.catch((error: AxiosError) => {
					this.statusManager.updateStatus(InstanceStatus.ConnectionFailure, error.code)
					return error
				})
		})
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
