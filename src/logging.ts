import type { AxiosError } from 'axios'
import type * as z from 'zod'

type Issue = z.core.$ZodIssue

/** Received values longer than this are cut short in the log */
const MAX_VALUE_LENGTH = 60

/** The path an issue is at, as a line prefix. Empty for an issue at the root of what is being described */
const at = (path: PropertyKey[]): string => (path.length ? `${path.map(String).join('.')}: ` : '')

/**
 * Why a nested issue failed, on one line. A union inside a key or element check, eg a key that has to match one of
 * several patterns, gives each option's reason joined by "or", where zod only gives "Invalid input".
 */
function reason(issue: Issue): string {
	if (issue.code === 'invalid_union' && issue.errors.length > 0) {
		return issue.errors.map((option) => option.map(reason).join('; ')).join(' or ')
	}
	return issue.message
}

/**
 * The value an issue was raised against, when the parse was run with `reportInput`. Only primitives are shown: an
 * object or array is the whole subtree, which says little and can be large.
 */
function received(issue: Issue): string {
	const input = issue.input
	if (input === undefined || (typeof input === 'object' && input !== null)) return ''
	// JSON.stringify throws on a bigint, and gives undefined for a function or symbol
	const text = typeof input === 'bigint' ? `${input.toString()}n` : (JSON.stringify(input) ?? typeof input)
	return ` (value ${text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text})`
}

function walk(issues: readonly Issue[], prefix: PropertyKey[], depth: number, out: string[]): void {
	const indent = '  '.repeat(depth)
	// Bad keys in one record usually share one reason, eg every Output key failing the Aux pattern. One line lists them
	const keyGroups = new Map<string, { line: number; parent: string; keys: string[]; why: string }>()

	for (const issue of issues) {
		const path = [...prefix, ...issue.path]
		if (issue.code === 'invalid_union' && issue.errors.length > 0) {
			out.push(`${indent}${at(path)}matched none of ${issue.errors.length} options`)
			issue.errors.forEach((optionIssues, index) => {
				// Paths inside an option are relative to the union, which the line above already names
				const lines: string[] = []
				walk(optionIssues, [], 0, lines)
				const label = `${indent}  option ${index + 1}:`
				if (lines.length === 1) out.push(`${label} ${lines[0]}`)
				else out.push(label, ...lines.map((line) => `${indent}    ${line}`))
			})
		} else if (issue.code === 'invalid_key') {
			const parent = at(path.slice(0, -1))
			const why = issue.issues.map(reason).join('; ')
			const groupKey = `${parent}\u0000${why}`
			const group = keyGroups.get(groupKey)
			if (group) group.keys.push(String(path[path.length - 1]))
			else {
				keyGroups.set(groupKey, { line: out.length, parent, keys: [String(path[path.length - 1])], why })
				out.push('') // Filled in below, once every key in the group is known
			}
		} else if (issue.code === 'invalid_element') {
			out.push(`${indent}${at(path)}element ${String(issue.key)}: ${issue.issues.map(reason).join('; ')}`)
		} else {
			out.push(`${indent}${at(path)}${issue.message}${received(issue)}`)
		}
	}

	for (const { line, parent, keys, why } of keyGroups.values()) {
		out[line] = `${indent}${parent}${keys.length === 1 ? 'key' : 'keys'} ${keys.join(', ')}: ${why}`
	}
}

/**
 * One line per problem, indented under the union that contained it. zod's own formatters stop at "Invalid input" on
 * a union, which hides the reason each option was rejected; that is usually the part that explains the failure.
 */
export function formatZodIssues(issues: readonly Issue[]): string[] {
	const out: string[] = []
	walk(issues, [], 0, out)
	return out
}

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
