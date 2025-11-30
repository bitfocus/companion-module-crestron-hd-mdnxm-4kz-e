import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	user: string
	selfSigned: boolean
	verbose: boolean
}

export interface ModuleSecrets {
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
			required: true,
		},
		{
			type: 'textinput',
			id: 'user',
			label: 'Username',
			width: 8,
			regex: Regex.SOMETHING,
			required: true,
		},
		{
			type: 'secret-text',
			id: 'passwd',
			label: 'Password',
			width: 8,
			regex: Regex.SOMETHING,
			required: true,
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
