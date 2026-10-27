import type { CompanionInputFieldDropdown, DropdownChoice } from '@companion-module/base'

export const AutoRouteState = ['on', 'off', 'toggle'] as const
export type AutoRouteState = (typeof AutoRouteState)[number]

const AUTO_ROUTE_CHOICES = [
	{ id: 'on', label: 'Enabled' },
	{ id: 'off', label: 'Disabled' },
	{ id: 'toggle', label: 'Toggle' },
] as const satisfies DropdownChoice<AutoRouteState>[]

// Source and destination choices are the device's own input and output keys, so they only exist at runtime.
// The default is the first one the device reports, or an empty string if it reports none.

export const destinationOption = (
	choices: DropdownChoice<string>[],
): CompanionInputFieldDropdown<'destination', string> => {
	return {
		id: 'destination',
		type: 'dropdown',
		label: 'Destination',
		choices: choices,
		default: choices[0]?.id ?? '',
	}
}

export const sourceOption = (choices: DropdownChoice<string>[]): CompanionInputFieldDropdown<'source', string> => {
	return {
		id: 'source',
		type: 'dropdown',
		label: 'Source',
		choices: choices,
		default: choices[0]?.id ?? '',
	}
}

export const autoRouteOption = (): CompanionInputFieldDropdown<'enable', AutoRouteState> => {
	return {
		id: 'enable',
		type: 'dropdown',
		label: 'Enable',
		choices: AUTO_ROUTE_CHOICES,
		default: AUTO_ROUTE_CHOICES[2].id,
	}
}
