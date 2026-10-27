import type { AxiosError } from 'axios'

/** Header names whose values are session credentials */
const SECRET_HEADERS = new Set(['set-cookie', 'cookie', 'crest-xsrf-token', 'authorization'])

/** A copy of the headers for the log, with cookie and token values replaced by the cookie names */
export function redactHeaders(headers: unknown): Record<string, unknown> {
	if (typeof headers !== 'object' || headers === null) return {}
	const plain =
		'toJSON' in headers && typeof headers.toJSON === 'function'
			? (headers.toJSON as () => Record<string, unknown>)()
			: (headers as Record<string, unknown>)
	const out: Record<string, unknown> = {}
	for (const [name, value] of Object.entries(plain)) {
		if (!SECRET_HEADERS.has(name.toLowerCase())) out[name] = value
		else if (Array.isArray(value)) out[name] = value.map((cookie) => `${String(cookie).split('=')[0]}=<redacted>`)
		else out[name] = '<redacted>'
	}
	return out
}

/** The device response, cut down to the sections the module parses. The rest includes network credentials */
export function deviceDataForLog(data: unknown): string | object {
	if (typeof data !== 'object' || data === null) return String(data)
	if (!('Device' in data)) return data
	const device = data.Device
	if (typeof device !== 'object' || device === null) return data
	const { AvioV2, AvMatrixRoutingV2, ...rest } = device as Record<string, unknown>
	return { Device: { AvioV2, AvMatrixRoutingV2 }, omitted: Object.keys(rest) }
}

/**
 * A one line summary of a failed request. `JSON.stringify` on an AxiosError includes the request config, which
 * holds the session cookies and, for the login, the form body with the password.
 */
export function describeAxiosError(err: AxiosError): string {
	const method = err.config?.method?.toUpperCase() ?? 'Request'
	const status = err.response ? `, HTTP ${err.response.status}` : ''
	return `${method} ${err.config?.url ?? ''} failed (${err.code ?? 'no code'}${status}): ${err.message}`
}
