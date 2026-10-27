import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

// Type aliases, not interfaces: InstanceTypes requires config and secrets to satisfy JsonObject, and interfaces don't
export type ModuleConfig = {
	host: string
	user: string
	selfSigned: boolean
	verbose: boolean
}

export type ModuleSecrets = {
	passwd: string
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Host IP',
			width: 8,
			regex: Regex.IP,
		},
		{
			type: 'textinput',
			id: 'user',
			label: 'Username',
			width: 8,
			regex: Regex.SOMETHING,
		},
		{
			type: 'secret-text',
			id: 'passwd',
			label: 'Password',
			width: 8,
			regex: Regex.SOMETHING,
		},
		{
			type: 'checkbox',
			id: 'selfSigned',
			label: 'Disable certificate validation',
			width: 4,
			default: false,
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Logs',
			width: 4,
			default: false,
		},
	]
}
