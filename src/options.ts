import { CompanionInputFieldDropdown, DropdownChoice } from '@companion-module/base'

export const destinationOption = (choices: DropdownChoice[]): CompanionInputFieldDropdown => {
	return {
		id: 'destination',
		type: 'dropdown',
		label: 'Destination',
		choices: choices,
		default: choices[0].id,
	}
}

export const sourceOption = (choices: DropdownChoice[]): CompanionInputFieldDropdown => {
	return {
		id: 'source',
		type: 'dropdown',
		label: 'Source',
		choices: choices,
		default: choices[0].id,
	}
}
