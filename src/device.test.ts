import { describe, it, expect, beforeEach } from 'vitest'
import { Crestron_HDMDNXM_4KZ } from './device.js'
import type { AxiosResponse } from 'axios'
import type { WebSocket } from 'ws'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeInputPort(overrides: Record<string, unknown> = {}) {
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

function makeInput(
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

function makeOutputPort(overrides: Record<string, unknown> = {}) {
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

function makeOutput(
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

function makeDeviceData(
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

/** Wrap raw data in a minimal AxiosResponse shape */
function makeAxiosResponse(data: unknown): AxiosResponse {
	return { data, status: 200, statusText: 'OK', headers: {}, config: {} as never }
}

/** Wrap a plain object in a WebSocket.MessageEvent shape */
function makeWsMessage(data: unknown): WebSocket.MessageEvent {
	return { data: JSON.stringify(data), type: 'message', target: {} as never }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Crestron_HDMDNXM_4KZ', () => {
	describe('createNewDevice', () => {
		it('creates an instance from a valid AxiosResponse', () => {
			const device = Crestron_HDMDNXM_4KZ.createNewDevice(makeAxiosResponse(makeDeviceData()))
			expect(device).toBeInstanceOf(Crestron_HDMDNXM_4KZ)
		})

		it('throws if the response data fails schema validation', () => {
			expect(() =>
				Crestron_HDMDNXM_4KZ.createNewDevice(makeAxiosResponse({ Device: { AvioV2: 'not-an-object' } })),
			).toThrow()
		})

		it('throws if Device key is missing entirely', () => {
			expect(() => Crestron_HDMDNXM_4KZ.createNewDevice(makeAxiosResponse({}))).toThrow()
		})
	})

	describe('feedbackSubscriptionTracker', () => {
		it('returns an object with AvioV2 and AvMatrixRoutingV2 Sets', () => {
			const tracker = Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker()
			expect(tracker.AvioV2).toBeInstanceOf(Set)
			expect(tracker.AvMatrixRoutingV2).toBeInstanceOf(Set)
		})

		it('returns empty Sets', () => {
			const tracker = Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker()
			expect(tracker.AvioV2.size).toBe(0)
			expect(tracker.AvMatrixRoutingV2.size).toBe(0)
		})

		it('returns a fresh tracker on each call', () => {
			const a = Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker()
			const b = Crestron_HDMDNXM_4KZ.feedbackSubscriptionTracker()
			a.AvioV2.add('some-feedback')
			expect(b.AvioV2.size).toBe(0)
		})
	})

	describe('getters', () => {
		let device: Crestron_HDMDNXM_4KZ

		beforeEach(() => {
			device = Crestron_HDMDNXM_4KZ.createNewDevice(
				makeAxiosResponse(
					makeDeviceData({
						inputs: {
							Input1: makeInput('Camera 1', { IsVideoRoutingSupported: true, IsAudioRoutingSupported: false }),
							Input2: makeInput('Mic 1', { IsVideoRoutingSupported: false, IsAudioRoutingSupported: true }),
							Input3: makeInput('Mixed', { IsVideoRoutingSupported: true, IsAudioRoutingSupported: true }),
						},
						outputs: {
							Output1: makeOutput('Screen A', { IsVideoRoutingSupported: true, IsAudioRoutingSupported: false }),
							Output2: makeOutput('Speakers', { IsVideoRoutingSupported: false, IsAudioRoutingSupported: true }),
						},
						routes: { Output1: { AudioSource: 'Input1', VideoSource: 'Input1' } },
						isAutomaticRoutingEnabled: true,
					}),
				),
			)
		})

		describe('AvioV2', () => {
			it('returns the AvioV2 section', () => {
				expect(device.AvioV2).toBeDefined()
				expect(device.AvioV2.GlobalConfig.GlobalEdid).toBe('Laptop 16x9 1080p50 2ch')
			})
		})

		describe('inputs', () => {
			it('returns all inputs', () => {
				expect(Object.keys(device.inputs)).toHaveLength(3)
			})

			it('contains the expected input names', () => {
				expect(device.inputs['Input1']?.UserSpecifiedName).toBe('Camera 1')
				expect(device.inputs['Input2']?.UserSpecifiedName).toBe('Mic 1')
			})
		})

		describe('inputChoices', () => {
			it('returns a choice for every input', () => {
				expect(device.inputChoices).toHaveLength(3)
			})

			it('formats choices as "Key: Name"', () => {
				const choice = device.inputChoices.find((c) => c.id === 'Input1')
				expect(choice?.label).toBe('Input1: Camera 1')
			})

			it('uses the input key as the choice id', () => {
				const ids = device.inputChoices.map((c) => c.id)
				expect(ids).toContain('Input1')
				expect(ids).toContain('Input2')
				expect(ids).toContain('Input3')
			})
		})

		describe('inputChoicesSupportingVideoRouting', () => {
			it('only includes inputs where IsVideoRoutingSupported is true', () => {
				const choices = device.inputChoicesSupportingVideoRouting
				const ids = choices.map((c) => c.id)
				expect(ids).toContain('Input1') // video only
				expect(ids).toContain('Input3') // both
				expect(ids).not.toContain('Input2') // audio only
			})
		})

		describe('inputChoicesSupportingAudioRouting', () => {
			it('only includes inputs where IsAudioRoutingSupported is true', () => {
				const choices = device.inputChoicesSupportingAudioRouting
				const ids = choices.map((c) => c.id)
				expect(ids).toContain('Input2') // audio only
				expect(ids).toContain('Input3') // both
				expect(ids).not.toContain('Input1') // video only
			})
		})

		describe('outputs', () => {
			it('returns all outputs', () => {
				expect(Object.keys(device.outputs)).toHaveLength(2)
			})

			it('contains the expected output names', () => {
				expect(device.outputs['Output1']?.UserSpecifiedName).toBe('Screen A')
				expect(device.outputs['Output2']?.UserSpecifiedName).toBe('Speakers')
			})
		})

		describe('outputChoices', () => {
			it('returns a choice for every output', () => {
				expect(device.outputChoices).toHaveLength(2)
			})

			it('formats choices as "Key: Name"', () => {
				const choice = device.outputChoices.find((c) => c.id === 'Output1')
				expect(choice?.label).toBe('Output1: Screen A')
			})
		})

		describe('outputChoicesSupportingVideoRouting', () => {
			it('only includes outputs where IsVideoRoutingSupported is true', () => {
				const choices = device.outputChoicesSupportingVideoRouting
				const ids = choices.map((c) => c.id)
				expect(ids).toContain('Output1')
				expect(ids).not.toContain('Output2')
			})
		})

		describe('outputChoicesSupportingAudioRouting', () => {
			it('only includes outputs where IsAudioRoutingSupported is true', () => {
				const choices = device.outputChoicesSupportingAudioRouting
				const ids = choices.map((c) => c.id)
				expect(ids).toContain('Output2')
				expect(ids).not.toContain('Output1')
			})
		})

		describe('AvRoutingMatrixV2', () => {
			it('returns the routing matrix section', () => {
				expect(device.AvRoutingMatrixV2).toBeDefined()
				expect(device.AvRoutingMatrixV2.Version).toBe('2.1.6')
			})
		})

		describe('routes', () => {
			it('returns current routes', () => {
				expect(device.routes).toBeDefined()
				expect((device.routes as any)['Output1']?.VideoSource).toBe('Input1')
			})
		})

		describe('autoRoute', () => {
			it('returns true when automatic routing is enabled', () => {
				expect(device.autoRoute).toBe(true)
			})

			it('returns false when automatic routing is disabled', () => {
				const d = Crestron_HDMDNXM_4KZ.createNewDevice(
					makeAxiosResponse(makeDeviceData({ isAutomaticRoutingEnabled: false })),
				)
				expect(d.autoRoute).toBe(false)
			})
		})
	})

	describe('partialUpdateDeviceFromWebSocketMessage', () => {
		let device: Crestron_HDMDNXM_4KZ

		beforeEach(() => {
			device = Crestron_HDMDNXM_4KZ.createNewDevice(makeAxiosResponse(makeDeviceData()))
		})

		it('returns an empty array when the Device payload has no keys', () => {
			// findChangedPaths compares the partial sub-object against the full stored
			// sub-object using isEqual. A partial with even one matching field will never
			// be deeply equal to the full object, so any key present in the partial is
			// always reported as changed. The only way to get an empty result is for the
			// parsed Device object to contain no iterable keys at all.
			const msg = makeWsMessage({ Device: {} })
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			expect(changed).toHaveLength(0)
		})

		it('returns the changed top-level key when a value differs', () => {
			const msg = makeWsMessage({
				Device: {
					AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: true },
				},
			})
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			expect(changed).toContain('AvMatrixRoutingV2')
		})

		it('actually merges the new value into the device state', () => {
			expect(device.autoRoute).toBe(false)
			device.partialUpdateDeviceFromWebSocketMessage(
				makeWsMessage({ Device: { AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: true } } }),
			)
			expect(device.autoRoute).toBe(true)
		})

		it('reports AvioV2 as changed when an input name changes', () => {
			const msg = makeWsMessage({
				Device: {
					AvioV2: {
						Inputs: { Input1: { UserSpecifiedName: 'Renamed Input' } },
					},
				},
			})
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			expect(changed).toContain('AvioV2')
		})

		it('merges the new input name into the device state', () => {
			device.partialUpdateDeviceFromWebSocketMessage(
				makeWsMessage({
					Device: { AvioV2: { Inputs: { Input1: { UserSpecifiedName: 'Renamed Input' } } } },
				}),
			)
			expect(device.inputs['Input1']?.UserSpecifiedName).toBe('Renamed Input')
		})

		it('does not report unchanged top-level keys as changed', () => {
			// Only change AvMatrixRoutingV2; AvioV2 should not appear in result
			const msg = makeWsMessage({
				Device: { AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: true } },
			})
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			expect(changed).not.toContain('AvioV2')
		})

		it('can report multiple top-level keys changed in one message', () => {
			const msg = makeWsMessage({
				Device: {
					AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: true },
					AvioV2: { Inputs: { Input1: { UserSpecifiedName: 'New Name' } } },
				},
			})
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			expect(changed).toContain('AvMatrixRoutingV2')
			expect(changed).toContain('AvioV2')
		})

		it('returns each changed key only once even if multiple nested fields differ', () => {
			const msg = makeWsMessage({
				Device: {
					AvMatrixRoutingV2: {
						IsAutomaticRoutingEnabled: true,
						IsPriorityRoutingEnabled: false,
					},
				},
			})
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			const avMatrixCount = changed.filter((k) => k === 'AvMatrixRoutingV2').length
			expect(avMatrixCount).toBe(1)
		})

		it('adds a new route without removing existing unrelated state', () => {
			// First, set up a route
			device.partialUpdateDeviceFromWebSocketMessage(
				makeWsMessage({ Device: { AvMatrixRoutingV2: { Routes: { Output1: { VideoSource: 'Input1' } } } } }),
			)
			// Then add another field change
			device.partialUpdateDeviceFromWebSocketMessage(
				makeWsMessage({ Device: { AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: true } } }),
			)
			// Route should still be there
			expect((device.routes as any)['Output1']?.VideoSource).toBe('Input1')
			// And the new change should have applied
			expect(device.autoRoute).toBe(true)
		})

		it('does not mutate routes when only an unrelated field is updated', () => {
			// Routes are not included in the partial, so they should be untouched after merge
			const routesBefore = device.routes
			device.partialUpdateDeviceFromWebSocketMessage(
				makeWsMessage({ Device: { AvMatrixRoutingV2: { IsAutomaticRoutingEnabled: true } } }),
			)
			expect(device.routes).toEqual(routesBefore)
		})

		it('handles a deeply nested change detection correctly', () => {
			// Change a value deep inside AvioV2 (sync status on a port)
			const msg = makeWsMessage({
				Device: {
					AvioV2: {
						Inputs: {
							Input1: {
								InputInfo: {
									Ports: {
										Port1: { IsSyncDetected: true },
									},
								},
							},
						},
					},
				},
			})
			const changed = device.partialUpdateDeviceFromWebSocketMessage(msg)
			expect(changed).toContain('AvioV2')
		})

		it('throws (or returns gracefully) on malformed WebSocket data', () => {
			const badMsg = { data: '{not valid json}', type: 'message', target: {} } as WebSocket.MessageEvent
			expect(() => device.partialUpdateDeviceFromWebSocketMessage(badMsg)).toThrow()
		})
	})
})
