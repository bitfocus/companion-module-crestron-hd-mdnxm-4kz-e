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
