import { type DropdownChoice } from '@companion-module/base'
import { Device } from './schemas/Device.js'
import * as AvioV2 from './schemas/AvioV2.js'
import * as AvMatrixRoutingV2 from './schemas/AvMatrixRoutingV2.js'
import { type AxiosResponse } from 'axios'

export class Crestron_HDMDNXM_4KZ {
	#HDMDNXM!: Device

	private constructor(newDevice: Device) {
		this.#HDMDNXM = Device.parse(newDevice)
	}

	static createNewDevice(response: AxiosResponse): Crestron_HDMDNXM_4KZ {
		const device = Device.parse(response.data)
		return new Crestron_HDMDNXM_4KZ(device)
	}

	get AvioV2(): Readonly<AvioV2.AvioV2> {
		return this.#HDMDNXM.Device.AvioV2
	}

	get inputs(): Readonly<AvioV2.Inputs> {
		return this.#HDMDNXM.Device.AvioV2.Inputs
	}

	get inputChoices(): Readonly<DropdownChoice[]> {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Inputs)) {
			choices.push({ id: key, label: value.UserSpecifiedName })
		}
		return choices
	}

	get inputChoicesSupportingVideoRouting(): Readonly<DropdownChoice[]> {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Inputs)) {
			if (value.Capabilities.IsVideoRoutingSupported) choices.push({ id: key, label: value.UserSpecifiedName })
		}
		return choices
	}

	get outputs(): Readonly<AvioV2.Outputs> {
		return this.#HDMDNXM.Device.AvioV2.Outputs
	}

	get outputChoices(): Readonly<DropdownChoice[]> {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Outputs)) {
			choices.push({ id: key, label: value.UserSpecifiedName })
		}
		return choices
	}

	get outputChoicesSupportingVideoRouting(): Readonly<DropdownChoice[]> {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Outputs)) {
			if (value.Capabilities.IsVideoRoutingSupported) choices.push({ id: key, label: value.UserSpecifiedName })
		}
		return choices
	}

	get AvRoutingMatrixV2(): Readonly<AvMatrixRoutingV2.AvMatrixRoutingV2> {
		return this.#HDMDNXM.Device.AvMatrixRoutingV2
	}

	get routes(): Readonly<AvMatrixRoutingV2.Routes> {
		return this.#HDMDNXM.Device.AvMatrixRoutingV2.Routes
	}
}
