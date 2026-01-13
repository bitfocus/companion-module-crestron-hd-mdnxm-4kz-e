import { InnerDevice } from './schemas/Device.js'

type Data = Record<string, boolean | number | string>

export type MsgData = string | Data | URLSearchParams

export type FeedbackSubscriptions = {
	[K in keyof InnerDevice]: Set<string>
}
