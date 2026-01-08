import * as z from 'zod'

import { Aux, Input, Output, Version } from './General.js'

export const IsAutomaticRoutingEnabled = z.boolean()

export type IsAutomaticRoutingEnabled = z.infer<typeof IsAutomaticRoutingEnabled>

export const IsFollowOutputEnabled = z.boolean()

export type IsFollowOutputEnabled = z.infer<typeof IsFollowOutputEnabled>

export const IsPriorityRoutingEnabled = z.boolean()

export type IsPriorityRoutingEnabled = z.infer<typeof IsPriorityRoutingEnabled>

export const AudioSource = z.union([Input, z.literal(['No Input'])])

export type AudioSource = z.infer<typeof AudioSource>

export const VideoSource = AudioSource

export type VideoSource = z.infer<typeof VideoSource>

export const AuxConfig = z.object({
	AudioSourceConfigured: AudioSource,
})

export type AuxConfig = z.infer<typeof AuxConfig>

export const OutputConfig = z.object({
	VideoSourceConfigured: VideoSource,
})

export type OutputConfig = z.infer<typeof OutputConfig>

export const AuxRoutes = z.object({
	AudioSource: AudioSource,
})

export type AuxRoutes = z.infer<typeof AuxRoutes>

export const OutputRoutes = z.object({
	AudioSource: AudioSource,
	VideoSource: VideoSource,
})

export type OutputRoutes = z.infer<typeof OutputRoutes>

export const AuxConfigRecord = z.record(Aux, AuxConfig)

export type AuxConfigRecord = z.infer<typeof AuxConfigRecord>

export const OutputConfigRecord = z.record(Output, OutputConfig)

export type OutputConfigRecord = z.infer<typeof OutputConfigRecord>

export const Config = z.union([AuxConfigRecord, OutputConfigRecord])

export type Config = z.infer<typeof Config>

export const AuxRouteRecord = z.record(Aux, AuxRoutes)

export type AuxRouteRecord = z.infer<typeof AuxRouteRecord>

export const OutputRouteRecord = z.record(Output, OutputRoutes)

export type OutputRouteRecord = z.infer<typeof OutputRouteRecord>

export const Routes = z.union([AuxRouteRecord, OutputRouteRecord])

export type Routes = z.infer<typeof Routes>

export const AvMatrixRoutingV2 = z.object({
	Config: Config,
	Routes: Routes,
	IsAutomaticRoutingEnabled: IsAutomaticRoutingEnabled,
	IsFollowOutputEnabled: IsFollowOutputEnabled,
	IsPriorityRoutingEnabled: IsPriorityRoutingEnabled,
	Version: Version,
})

export type AvMatrixRoutingV2 = z.infer<typeof AvMatrixRoutingV2>
