import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	user: string
	passwd: string
	selfSigned: boolean
	verbose: boolean
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Host',
			width: 8,
			regex: Regex.HOSTNAME,
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
