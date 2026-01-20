import * as z from 'zod'

import { Input as InputString, Output as OutputString, Aux as AuxString, Version } from './General.js'

export const GlobalEdid = z.string()

export type GlobalEdid = z.infer<typeof GlobalEdid>

export const GlobalEdidTypes = ['copy', 'system', 'custom'] as const satisfies string[]

export const GlobalEdidType = z.enum(GlobalEdidTypes).or(z.string())

export type GlobalEdidType = z.infer<typeof GlobalEdidType>

export const GlobalConfig = z.object({
	GlobalEdid: GlobalEdid,
	GlobalEdidType: GlobalEdidType,
})

export type GlobalConfig = z.infer<typeof GlobalConfig>

export const Id = z.string().optional()

export type Id = z.infer<typeof Id>

export const UserSpecifiedName = z.string().min(0).max(24)

export type UserSpecifiedName = z.infer<typeof UserSpecifiedName>

export const IsAudioRoutingSupported = z.boolean()

export type IsAudioRoutingSupported = z.infer<typeof IsAudioRoutingSupported>

export const IsVideoRoutingSupported = z.boolean()

export type IsVideoRoutingSupported = z.infer<typeof IsVideoRoutingSupported>

export const IsUsbRoutingSupported = z.boolean()

export type IsUsbRoutingSupported = z.infer<typeof IsUsbRoutingSupported>

export const IsStreamRoutingSupported = z.boolean()

export type IsStreamRoutingSupported = z.infer<typeof IsStreamRoutingSupported>

export const InputCapabilities = z.object({
	IsAudioRoutingSupported: IsAudioRoutingSupported,
	IsVideoRoutingSupported: IsVideoRoutingSupported,
	IsUsbRoutingSupported: IsUsbRoutingSupported,
	IsStreamRoutingSupported: IsStreamRoutingSupported,
})

export type InputCapabilities = z.infer<typeof InputCapabilities>

export const InputPortTypes = [
	'Hdmi',
	'Dm',
	'Analog',
	'DisplayPort',
	'Airmedia',
	'Streaming',
] as const satisfies string[]

export const InputPortType = z.enum(InputPortTypes)

export type InputPortType = z.infer<typeof InputPortType>

export const IsSyncDetected = z.boolean()

export type IsSyncDetected = z.infer<typeof IsSyncDetected>

export const IsSourceDetected = z.boolean().optional()

export type IsSourceDetected = z.infer<typeof IsSourceDetected>

export const IsInterlacedDetected = z.boolean()

export type IsInterlacedDetected = z.infer<typeof IsInterlacedDetected>

export const HorizontalResolution = z.int32().min(0).max(0xffff).optional()

export type HorizontalResolution = z.infer<typeof HorizontalResolution>

export const VerticalResolution = HorizontalResolution

export type VerticalResolution = z.infer<typeof VerticalResolution>

export const FramesPerSecond = HorizontalResolution

export type FramesPerSecond = z.infer<typeof FramesPerSecond>

export const AspectRatio = z.string().optional()

export type AspectRatio = z.infer<typeof AspectRatio>

export const CurrentResolution = z.string().optional()

export type CurrentResolution = z.infer<typeof CurrentResolution>

export const CurrentEdid = z.string()

export type CurrentEdid = z.infer<typeof CurrentEdid>

export const CurrentEdidType = z.enum(GlobalEdidTypes).or(z.string())

export type CurrentEdidType = z.infer<typeof CurrentEdidType>

export const EdidApplyErrors = [
	'No err',
	'Errors detected, EDID not Programmed.',
	'Programming failed.',
	'EDID is analog and device is digital only.',
	'Programmed analog EDID to digital only device.',
	'EDID is digital and device is analog only.',
	'Programmed digital EDID to analog only device.',
	'EDID is CEA and device is VESA only.',
	'Programmed CEA EDID to VESA only device.',
	'EDID is missing CEA block and input is HDMI(DM Lite).',
	'Wrong EDID version.',
	'Checksum error.',
	'Format error.',
	'Does not support deep color.',
	'Does not support high bitrate audio.',
	'Does not support 3D.',
	'Does not support low bitrate audio.',
	'Unsupported audio format.',
	'Exceeds device bandwidth.',
	'Missing default timing.',
] as const satisfies string[]

export const EdidApplyError = z.enum(EdidApplyErrors)

export type EdidApplyError = z.infer<typeof EdidApplyError>

export const IsSourceHdcpActive = z.boolean()

export type IsSourceHdcpActive = z.infer<typeof IsSourceHdcpActive>

export const HdcpReceiverCapabilities = [
	'HDCP Support Off',
	'Auto',
	'HDCP 1.4 Support',
	'HDCP 2.x Support',
] as const satisfies string[]

export const HdcpReceiverCapability = z.enum(HdcpReceiverCapabilities)

export type HdcpReceiverCapability = z.infer<typeof HdcpReceiverCapability>

export const HdcpStates = [
	'NotRequired',
	'Unauthenticated',
	'Busy',
	'Authenticated',
	'NonHdcpSource',
] as const satisfies string[]

export const HdcpState = z.enum(HdcpStates)

export type HdcpState = z.infer<typeof HdcpState>

export const SourceHdcps = ['No Signal', 'Non-HDCP', 'HDCP 1.x', 'HDCP 2.x'] as const satisfies string[]

export const SourceHdcp = z.enum(SourceHdcps)

export type SourceHdcp = z.infer<typeof SourceHdcp>

export const SourceContentStreamTypes = ['Type 0', 'Type 1'] as const satisfies string[]

export const SourceContentStreamType = z.enum(SourceContentStreamTypes).or(z.string())

export type SourceContentStreamType = z.infer<typeof SourceContentStreamType>

export const ColorSpaces = ['Auto', 'ForceRgb', 'ForceYCbCr', 'UNKNOWN'] as const satisfies string[]

export const ColorSpace = z.enum(ColorSpaces)

export type ColorSpace = z.infer<typeof ColorSpace>

export const ColorDepths = ['Pixel8bit', 'Pixel10bit', 'Pixel12bit'] as const satisfies string[]

export const ColorDepth = z.enum(ColorDepths).or(z.string())

export type ColorDepth = z.infer<typeof ColorDepth>

export const IsCecErrorDetected = z.boolean()

export type IsCecErrorDetected = z.infer<typeof IsCecErrorDetected>

export const Cec = z.object({
	IsCecErrorDetected: IsCecErrorDetected,
})

export type Cec = z.infer<typeof Cec>

export const Status3Ds = ['Video2D', 'Video3D'] as const satisfies string[]

export const Status3D = z.enum(Status3Ds).or(z.string())

export type Status3D = z.infer<typeof Status3D>

export const Digital = z.object({
	IsSourceHdcpActive: IsSourceHdcpActive,
	HdcpReceiverCapability: HdcpReceiverCapability,
	HdcpState: HdcpState,
	SourceHdcp: SourceHdcp,
	SourceContentStreamType: SourceContentStreamType,
	ColorSpace: ColorSpace.or(z.string()),
	ColorDepth: ColorDepth,
	Cec: Cec,
	Status3D: Status3D,
})

export type Digital = z.infer<typeof Digital>

export const IsAudioSourceDetected = z.boolean().optional()

export type IsAudioSourceDetected = z.infer<typeof IsAudioSourceDetected>

export const Channels = z.int32().min(0).max(0xffff)

export type Channels = z.infer<typeof Channels>

export const Formats = [
	'NoAudio',
	'Pcm',
	'DolbyDigital',
	'Dts',
	'DolbyDigitalPlus',
	'DtsHd',
	'DolbyTrueHd',
	'LbrCompressed',
	'HbrCompressed',
] as const satisfies string[]

export const Format = z.enum(Formats).or(z.string())

export type Format = z.infer<typeof Format>

export const SamplingFrequency = z.int32().min(0).max(0xffff)

export type SamplingFrequency = z.infer<typeof SamplingFrequency>

export const Gain = z.number().min(-100).max(100).optional()

export type Gain = z.infer<typeof Gain>

export const DigitalAudio = z.object({
	IsAudioSourceDetected: IsAudioSourceDetected,
	Channels: Channels,
	Format: Format,
	SamplingFrequency: SamplingFrequency,
	Gain: Gain,
})

export type DigitalAudio = z.infer<typeof DigitalAudio>

export const SpidifGain = z.number().min(-100).max(100).optional()

export type SpidifGain = z.infer<typeof SpidifGain>

export const AnalogGain = z.number().min(-100).max(100).optional()

export type AnalogGain = z.infer<typeof AnalogGain>

export const Audio = z.object({
	Digital: DigitalAudio,
	SpidifGain: SpidifGain,
	AnalogGain: AnalogGain,
})

export type Audio = z.infer<typeof Audio>

export const InputPort = z.object({
	PortType: InputPortType,
	IsSyncDetected: IsSyncDetected,
	IsSourceDetected: IsSourceDetected,
	IsInterlacedDetected: IsInterlacedDetected,
	HorizontalResolution: HorizontalResolution,
	VerticalResolution: VerticalResolution,
	FramesPerSecond: FramesPerSecond,
	AspectRatio: AspectRatio,
	CurrentResolution: CurrentResolution,
	CurrentEdid: CurrentEdid,
	CurrentEdidType: CurrentEdidType,
	EdidApplyError: EdidApplyError,
	Digital: Digital,
	Audio: Audio,
})

export type InputPort = z.infer<typeof InputPort>

export const PortString = z.string().regex(/^Port\d+$/, {
	message: 'Value must match Port<number> with no spaces or extra characters',
})

export type PortString = z.infer<typeof PortString>

export const InputPorts = z.record(PortString, InputPort)

export type InputPorts = z.infer<typeof InputPorts>

export const InputInfo = z.object({
	Id: Id.optional(),
	Ports: InputPorts,
})

export type InputInfo = z.infer<typeof InputInfo>

export const Input = z.object({
	Id: Id,
	UserSpecifiedName: UserSpecifiedName,
	Capabilities: InputCapabilities,
	InputInfo: InputInfo,
})

export type Input = z.infer<typeof Input>

export const Inputs = z.record(InputString, Input)

export type Inputs = z.infer<typeof Inputs>

export const OutputCapabilities = z.object({
	IsAudioRoutingSupported: IsAudioRoutingSupported,
	IsVideoRoutingSupported: IsVideoRoutingSupported,
	IsUsbRoutingSupported: IsUsbRoutingSupported,
	IsStreamRoutingSupported: IsStreamRoutingSupported,
})

export const OutputPortTypes = ['Hdmi', 'Dm', 'Analog', 'DisplayPort', 'Audio'] as const satisfies string[]

export const OutputPortType = z.enum(OutputPortTypes).or(z.string())

export type OutputPortType = z.infer<typeof OutputPortType>

export const IsSinkConnected = z.boolean().optional()

export type IsSinkConnected = z.infer<typeof IsSinkConnected>

export const OutputColorSpaces = ['RGB', 'YCbCr', 'UNKNOWN'] as const satisfies string[]

export const OutputColorSpace = z.enum(OutputColorSpaces).or(z.string())

export type OutputColorSpace = z.infer<typeof OutputColorSpace>

export const OutputColorDepth = z.enum(ColorDepths).or(z.string())

export type OutputColorDepth = z.infer<typeof OutputColorDepth>

export const OutputColorSpaceModes = ['Auto', 'ForceRgb', 'ForceYCbCr'] as const satisfies string[]

export const OutputColorSpaceMode = z.enum(OutputColorSpaceModes).or(z.string())

export type OutputColorSpaceMode = z.infer<typeof OutputColorSpaceMode>

export const OutputMaxColorDepths = ['Pixel8bit', 'Pixel10bit', 'Pixel12bit'] as const satisfies string[]

export const OutputMaxColorDepth = z.enum(OutputMaxColorDepths).or(z.string())

export type OutputMaxColorDepth = z.infer<typeof OutputMaxColorDepth>

export const Orientation = z.string()

export type Orientation = z.infer<typeof Orientation>

export const IsTransmitting = z.boolean()

export type IsTransmitting = z.infer<typeof IsTransmitting>

export const IsBlankingEnabled = z.boolean()

export type IsBlankingEnabled = z.infer<typeof IsBlankingEnabled>

export const DisabledByHdcp = z.boolean()

export type DisabledByHdcp = z.infer<typeof DisabledByHdcp>

export const IsHdcpForceDisabled = z.boolean()

export type IsHdcpForceDisabled = z.infer<typeof IsHdcpForceDisabled>

export const IsOutputDisabled = z.boolean()

export type IsOutputDisabled = z.infer<typeof IsOutputDisabled>

export const OutputHdcpState = z.string()

export type OutputHdcpState = z.infer<typeof OutputHdcpState>

export const HdcpTransmitterModes = [
	'Auto',
	'Follow Input',
	'Force Highest',
	'Never Authenticate',
	'N/A',
] as const satisfies string[]

export const HdcpTransmitterMode = z.enum(HdcpTransmitterModes)

export type HdcpTransmitterMode = z.infer<typeof HdcpTransmitterMode>

export const HdcpSinkCapabilities = ['Unknown', 'HDCP 1.x', 'HDCP 2.x', 'Not Connected'] as const satisfies string[]

export const HdcpSinkCapability = z.enum(HdcpReceiverCapabilities).or(z.string())

export type HdcpSinkCapability = z.infer<typeof HdcpSinkCapability>

export const OutputStatus3D = z.string()

export type OutputStatus3D = z.infer<typeof OutputStatus3D>

export const Manufacturer = z.string()

export type Manufacturer = z.infer<typeof Manufacturer>

export const SerialNumber = z.string()

export type SerialNumber = z.infer<typeof SerialNumber>

export const Name = z.string()

export type Name = z.infer<typeof Name>

export const DownstreamEdid = z.object({
	Manufacturer: Manufacturer,
	SerialNumber: SerialNumber,
	Name: Name,
})

export type DownstreamEdid = z.infer<typeof DownstreamEdid>

export const OutputDigital = z.object({
	IsTransmitting: IsTransmitting,
	IsBlankingEnabled: IsBlankingEnabled,
	DisabledByHdcp: DisabledByHdcp,
	IsHdcpForceDisabled: IsHdcpForceDisabled,
	IsOutputDisabled: IsOutputDisabled,
	HdcpState: OutputHdcpState,
	Cec: Cec,
	HdcpTransmitterMode: HdcpTransmitterMode,
	HdcpSinkCapability: HdcpSinkCapability,
	Status3D: OutputStatus3D,
	DownstreamEdid: DownstreamEdid,
})

export type OutputDigital = z.infer<typeof OutputDigital>

export const Mute = z.boolean()

export type Mute = z.infer<typeof Mute>

export const OutputPortAudioDigital = z.object({
	Channels: Channels,
	Format: Format,
})

export type OutputPortAudioDigital = z.infer<typeof OutputPortAudioDigital>

export const OutputPortAudio = z.object({
	Mute: Mute,
	Digital: OutputPortAudioDigital,
})

export type OutputPortAudio = z.infer<typeof OutputPortAudio>

export const OutputPort = z.object({
	PortType: OutputPortType,
	IsSinkConnected: IsSinkConnected,
	IsSourceDetected: IsSourceDetected,
	ColorSpace: OutputColorSpace.optional(),
	ColorDepth: OutputColorDepth.optional(),
	ColorSpaceMode: OutputColorSpaceMode.optional(),
	MaxColorDepth: OutputMaxColorDepth.optional(),
	HorizontalResolution: HorizontalResolution,
	VerticalResolution: VerticalResolution,
	FramesPerSecond: FramesPerSecond,
	AspectRatio: AspectRatio,
	CurrentResolution: CurrentResolution,
	Digital: OutputDigital.partial().optional(),
})

export type OutputPort = z.infer<typeof OutputPort>

export const OutputPorts = z.record(PortString, OutputPort)

export type OutputPorts = z.infer<typeof OutputPorts>

export const OutputInfo = z.object({
	Id: Id,
	Ports: OutputPorts,
})
export type OutputInfo = z.infer<typeof OutputInfo>

export const Output = z.object({
	Id: Id,
	UserSpecifiedName: UserSpecifiedName,
	Capabilities: InputCapabilities,
	OutputInfo: OutputInfo,
})

export type Output = z.infer<typeof Output>

export const Outputs = z.record(z.union([OutputString, AuxString]), Output)

export type Outputs = z.infer<typeof Outputs>

export const AvioV2 = z.object({
	GlobalConfig: GlobalConfig,
	Inputs: Inputs,
	Outputs: Outputs,
	Version: Version,
})

export type AvioV2 = z.infer<typeof AvioV2>
