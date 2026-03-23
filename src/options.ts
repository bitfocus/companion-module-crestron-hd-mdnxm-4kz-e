import { CompanionInputFieldDropdown, DropdownChoice } from '@companion-module/base'

export const destinationOption = (choices: DropdownChoice[]): CompanionInputFieldDropdown => {
	return {
		id: 'destination',
		type: 'dropdown',
		label: 'Destination',
		choices: choices,
		default: choices[0]?.id ?? '',
	}
}

export const sourceOption = (choices: DropdownChoice[]): CompanionInputFieldDropdown => {
	return {
		id: 'source',
		type: 'dropdown',
		label: 'Source',
		choices: choices,
		default: choices[0]?.id ?? '',
	}
}

export const autoRouteOption = (): CompanionInputFieldDropdown => {
	return {
		id: 'enable',
		type: 'dropdown',
		label: 'Enable',
		choices: [
			{ id: 'on', label: 'Enabled' },
			{ id: 'off', label: 'Disabled' },
			{ id: 'toggle', label: 'Toggle' },
		],
		default: 'toggle',
	}
}
