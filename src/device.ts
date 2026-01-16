import { type DropdownChoice } from '@companion-module/base'
import { Device, type InnerDevice, PartialDevice } from './schemas/Device.js'
import * as AvioV2 from './schemas/AvioV2.js'
import * as AvMatrixRoutingV2 from './schemas/AvMatrixRoutingV2.js'
import { FeedbackSubscriptions } from './types.js'
import { type AxiosResponse } from 'axios'
import { type WebSocket } from 'ws'
import { merge, isEqual } from 'es-toolkit'
export class Crestron_HDMDNXM_4KZ {
	#HDMDNXM!: Device

	private constructor(newDevice: Device) {
		this.#HDMDNXM = Device.parse(newDevice)
	}

	static createNewDevice(response: AxiosResponse): Crestron_HDMDNXM_4KZ {
		const device = Device.parse(response.data)
		return new Crestron_HDMDNXM_4KZ(device)
	}

	static feedbackSubscriptionTracker(): FeedbackSubscriptions {
		return {
			AvioV2: new Set(),
			AvMatrixRoutingV2: new Set(),
		}
	}

	public partialUpdateDeviceFromWebSocketMessage(partialDevice: WebSocket.MessageEvent): Array<keyof InnerDevice> {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		const parsedPartialDevice = PartialDevice.parse(JSON.parse(partialDevice.data.toString()))

		// Collect top-level keys that have changes somewhere in their nested structure
		const changedKeys = new Set<keyof InnerDevice>()

		if (parsedPartialDevice.Device) {
			this.findChangedPaths(parsedPartialDevice.Device, this.#HDMDNXM.Device || {}, (topLevelKey) =>
				changedKeys.add(topLevelKey),
			)
		}

		// Only merge if there are changes
		if (changedKeys.size > 0) {
			merge(this.#HDMDNXM, parsedPartialDevice)
		}

		return Array.from(changedKeys)
	}

	private findChangedPaths(
		partialData: any,
		existingData: any,
		onTopLevelChange: (key: keyof InnerDevice) => void,
		currentTopLevelKey?: keyof InnerDevice,
	): void {
		for (const key of Object.keys(partialData)) {
			const topKey = currentTopLevelKey ?? (key as keyof InnerDevice)
			const newValue = partialData[key]
			const oldValue = existingData?.[key]

			// Check if this specific value differs
			if (!isEqual(oldValue, newValue)) {
				onTopLevelChange(topKey)
				// No need to recurse further once we know this top-level key changed
				continue
			}

			// If values are equal but both are objects, recurse to check nested properties
			if (newValue && typeof newValue === 'object' && !Array.isArray(newValue)) {
				this.findChangedPaths(newValue, oldValue || {}, onTopLevelChange, topKey)
			}
		}
	}

	get AvioV2(): Readonly<AvioV2.AvioV2> {
		return this.#HDMDNXM.Device.AvioV2
	}

	get inputs(): Readonly<AvioV2.Inputs> {
		return this.#HDMDNXM.Device.AvioV2.Inputs
	}

	get inputChoices(): DropdownChoice[] {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Inputs)) {
			choices.push({ id: key, label: `${key}: ${value.UserSpecifiedName}` })
		}
		return choices
	}

	get inputChoicesSupportingVideoRouting(): DropdownChoice[] {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Inputs)) {
			if (value.Capabilities.IsVideoRoutingSupported)
				choices.push({ id: key, label: `${key}: ${value.UserSpecifiedName}` })
		}
		return choices
	}

	get inputChoicesSupportingAudioRouting(): DropdownChoice[] {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Inputs)) {
			if (value.Capabilities.IsAudioRoutingSupported)
				choices.push({ id: key, label: `${key}: ${value.UserSpecifiedName}` })
		}
		return choices
	}

	get outputs(): Readonly<AvioV2.Outputs> {
		return this.#HDMDNXM.Device.AvioV2.Outputs
	}

	get outputChoices(): DropdownChoice[] {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Outputs)) {
			choices.push({ id: key, label: `${key}: ${value.UserSpecifiedName}` })
		}
		return choices
	}

	get outputChoicesSupportingVideoRouting(): DropdownChoice[] {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Outputs)) {
			if (value.Capabilities.IsVideoRoutingSupported)
				choices.push({ id: key, label: `${key}: ${value.UserSpecifiedName}` })
		}
		return choices
	}

	get outputChoicesSupportingAudioRouting(): DropdownChoice[] {
		const choices: DropdownChoice[] = []
		for (const [key, value] of Object.entries(this.#HDMDNXM.Device.AvioV2.Outputs)) {
			if (value.Capabilities.IsAudioRoutingSupported)
				choices.push({ id: key, label: `${key}: ${value.UserSpecifiedName}` })
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
