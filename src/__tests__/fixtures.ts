import { readFileSync } from 'node:fs'

/**
 * Builders for device data shaped like the HD-MDNXM-4KZ-E's /Device response. Shared by the specs, and kept out of
 * any *.spec.ts file so importing them doesn't also import, and rerun, that file's tests.
 */

export function makeInputPort(overrides: Record<string, unknown> = {}) {
	return {
		PortType: 'Hdmi',
		IsSyncDetected: false,
		IsInterlacedDetected: false,
		CurrentEdid: 'Laptop 16x9 1080p50 2ch',
		CurrentEdidType: 'system',
		EdidApplyError: 'No err',
		Digital: {
			IsSourceHdcpActive: false,
			HdcpReceiverCapability: 'HDCP Support Off',
			HdcpState: 'NonHdcpSource',
			SourceHdcp: 'No Signal',
			SourceContentStreamType: 'Type 0 Content Stream',
			ColorSpace: 'UNKNOWN',
			ColorDepth: '8 - bit',
			Cec: { IsCecErrorDetected: false },
			Status3D: 'No 3D',
		},
		Audio: {
			Digital: { Channels: 0, Format: 'No Audio', SamplingFrequency: 0 },
		},
		...overrides,
	}
}

export function makeInput(
	name: string,
	caps: Partial<{ IsVideoRoutingSupported: boolean; IsAudioRoutingSupported: boolean }> = {},
	portOverrides: Record<string, unknown> = {},
) {
	return {
		UserSpecifiedName: name,
		Capabilities: {
			IsAudioRoutingSupported: true,
			IsVideoRoutingSupported: true,
			IsUsbRoutingSupported: false,
			IsStreamRoutingSupported: false,
			...caps,
		},
		InputInfo: { Ports: { Port1: makeInputPort(portOverrides) } },
	}
}

export function makeOutputPort(overrides: Record<string, unknown> = {}) {
	return {
		PortType: 'Dm',
		IsSinkConnected: false,
		IsInterlacedDetected: false,
		Digital: {
			IsTransmitting: false,
			IsBlankingEnabled: false,
			DisabledByHdcp: false,
			IsOutputDisabled: false,
			HdcpState: 'NotRequired',
			Cec: { IsCecErrorDetected: false },
			HdcpTransmitterMode: 'Follow Input',
			HdcpSinkCapability: 'Not Connected',
			Status3D: 'No 3D',
			DownstreamEdid: { Manufacturer: '', SerialNumber: '', Name: '' },
		},
		...overrides,
	}
}

export function makeOutput(
	name: string,
	caps: Partial<{ IsVideoRoutingSupported: boolean; IsAudioRoutingSupported: boolean }> = {},
) {
	return {
		UserSpecifiedName: name,
		Capabilities: {
			IsAudioRoutingSupported: true,
			IsVideoRoutingSupported: true,
			IsUsbRoutingSupported: false,
			IsStreamRoutingSupported: false,
			...caps,
		},
		OutputInfo: { Ports: { Port1: makeOutputPort() } },
	}
}

export function makeDeviceData(
	overrides: {
		inputs?: Record<string, unknown>
		outputs?: Record<string, unknown>
		routes?: Record<string, unknown>
		isAutomaticRoutingEnabled?: boolean
	} = {},
) {
	return {
		Device: {
			AvioV2: {
				GlobalConfig: { GlobalEdid: 'Laptop 16x9 1080p50 2ch', GlobalEdidType: 'system' },
				Inputs: overrides.inputs ?? {
					Input1: makeInput('HDMI 1'),
					Input2: makeInput('HDMI 2'),
				},
				Outputs: overrides.outputs ?? {
					Output1: makeOutput('DM OUT 1'),
				},
				Version: '3.0.70',
			},
			AvMatrixRoutingV2: {
				Routes: overrides.routes ?? {},
				RoutePriorities: {
					Output1: { PriorityList: { Input1: 1, Input2: 1 } },
				},
				IsAutomaticRoutingEnabled: overrides.isAutomaticRoutingEnabled ?? false,
				IsPriorityRoutingEnabled: true,
				Version: '2.1.6',
				SyncDetectedOrder: '0-0',
			},
		},
	}
}

/**
 * GET /Device from an HD-MD8X8-4KZ-E, firmware built Feb 10 2024 (530849), taken from a user's module log of
 * 2026-10-27. Only AvioV2 and AvMatrixRoutingV2 are kept: nothing else is parsed, and the rest carried the unit's
 * authentication and network settings.
 *
 * Aux1 and Aux2 are audio-only outputs, so its routing Config and Routes have Aux and Output keys in the same object.
 * State at capture: automatic routing off, priority routing on, Aux1 and Aux2 taking audio from Input2, Output1 video
 * from Input2, Output2-4 from Input8, Output5-7 from Input1 and Output8 from Input2, each with audio following.
 * Config is present, but only for Aux1, Aux2, Output1,
 * Output2, Output7 and Output8.
 */
export function loadHdMd8x8Capture(): { Device: Record<string, unknown> } {
	return JSON.parse(readFileSync(new URL('./captures/hd-md8x8-4kz-e.json', import.meta.url), 'utf8')) as {
		Device: Record<string, unknown>
	}
}
