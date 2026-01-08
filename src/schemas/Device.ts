import * as z from 'zod'
import { zx } from '@traversable/zod'

import { AvioV2 } from './AvioV2.js'
import { AvRoutingMatrixV2 } from './AvRoutingMatrixV2.js'

export const Device = z.object({
	Device: z.object({
		AvioV2: AvioV2,
		AvRoutingMatrixV2: AvRoutingMatrixV2,
	}),
})

export type Device = z.infer<typeof Device>

export const PartialDevice = zx.deepPartial(Device)

export type PartialDevice = z.output<typeof PartialDevice>
