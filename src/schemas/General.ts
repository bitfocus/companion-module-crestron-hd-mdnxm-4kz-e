import * as z from 'zod'

export const Version = z.string().regex(/^\d+\.\d+\.\d+$/, {
	message: 'Version must be in the format X.Y.Z (e.g., 2.0.0)',
})

export type Version = z.infer<typeof Version>

export const Aux = z.string().regex(/^Aux\d+$/, {
	message: 'Value must match Aux<number> with no spaces or extra characters',
})

export type Aux = z.infer<typeof Aux>

export const Input = z.string().regex(/^Input\d+$/, {
	message: 'Value must match Input<number> with no spaces or extra characters',
})

export type Input = z.infer<typeof Input>

export const Output = z.string().regex(/^Output\d+$/, {
	message: 'Value must match Output<number> with no spaces or extra characters',
})

export type Output = z.infer<typeof Output>
