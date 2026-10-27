import * as z from 'zod'

import { AvioV2 } from './AvioV2.js'
import { AvMatrixRoutingV2 } from './AvMatrixRoutingV2.js'

export const Device = z.compile(
	z.object({
		Device: z.object({
			AvioV2: AvioV2,
			AvMatrixRoutingV2: AvMatrixRoutingV2,
		}),
	}),
)

export type Device = z.infer<typeof Device>

// Parsed against every WebSocket message, so derived and compiled once here rather than at the parse site
export const PartialDevice = z.compile(z.deepPartial(Device))

export type PartialDevice = z.output<typeof PartialDevice>

export type InnerDevice = z.infer<typeof Device>['Device']
