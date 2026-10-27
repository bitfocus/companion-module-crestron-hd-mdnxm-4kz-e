import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describeAxiosError, deviceDataForLog, formatZodIssues, redactHeaders } from '../logging.js'
import { AuxRouteRecord, OutputRouteRecord, Routes } from '../schemas/AvMatrixRoutingV2.js'
import { loadHdMd8x8Capture } from './fixtures.js'

const AUX_PATTERN = 'Value must match Aux<number> with no spaces or extra characters'
const OUTPUT_PATTERN = 'Value must match Output<number> with no spaces or extra characters'

const captureRoutes = (): Record<string, unknown> =>
	(loadHdMd8x8Capture().Device as { AvMatrixRoutingV2: { Routes: Record<string, unknown> } }).AvMatrixRoutingV2.Routes

function issues(schema: z.ZodType, data: unknown): z.core.$ZodIssue[] {
	const result = schema.safeParse(data, { reportInput: true })
	if (result.success) throw new Error('expected the parse to fail')
	return result.error.issues
}

describe('formatZodIssues', () => {
	// The failure in the user's log of 2026-10-27, which was logged as "Routes: Invalid input" and nothing else
	it('says why each option of a union was rejected, for the HD-MD8X8 routes the old schema refused', () => {
		const oldRoutes = z.object({ Routes: z.union([AuxRouteRecord, OutputRouteRecord]) })
		expect(formatZodIssues(issues(oldRoutes, { Routes: captureRoutes() }))).toEqual([
			'Routes: matched none of 2 options',
			`  option 1: keys Output1, Output2, Output3, Output4, Output5, Output6, Output7, Output8: ${AUX_PATTERN}`,
			`  option 2: keys Aux1, Aux2: ${OUTPUT_PATTERN}`,
		])
	})

	it('gives every pattern a key failed, where zod only says "Invalid input"', () => {
		const lines = formatZodIssues(issues(z.object({ Routes }), { Routes: { ...captureRoutes(), Foo1: {} } }))
		expect(lines[0]).toBe('Routes: matched none of 3 options')
		expect(lines).toContain(`  option 3: key Foo1: ${OUTPUT_PATTERN} or ${AUX_PATTERN}`)
	})

	it('shows the value received when it is a primitive, cut short when long', () => {
		const schema = z.object({ a: z.boolean(), b: z.number(), c: z.string() })
		expect(formatZodIssues(issues(schema, { a: 'yes', b: { nested: true }, c: 'x'.repeat(100) }).slice(0, 2))).toEqual([
			'a: Invalid input: expected boolean, received string (value "yes")',
			'b: Invalid input: expected number, received object',
		])
		expect(formatZodIssues(issues(z.object({ c: z.number() }), { c: 'x'.repeat(100) }))[0]).toContain(
			`(value "${'x'.repeat(59)}…)`,
		)
	})
})

describe('redactHeaders', () => {
	// Shaped like the headers the device returns on login, with made-up values
	const headers = new AxiosHeaders({
		'access-control-allow-credentials': 'true',
		'set-cookie': ['userstr=example-user;Path=/;Secure;HttpOnly;', 'userid=example-session;Path=/;Secure;HttpOnly;'],
		'crest-xsrf-token': 'token-value',
	})

	it('keeps cookie names and drops their values', () => {
		expect(redactHeaders(headers)).toEqual({
			'access-control-allow-credentials': 'true',
			'set-cookie': ['userstr=<redacted>', 'userid=<redacted>'],
			'crest-xsrf-token': '<redacted>',
		})
	})

	it('handles plain header objects too', () => {
		expect(redactHeaders({ Cookie: 'TRACKID=abc', Server: 'x' })).toEqual({ Cookie: '<redacted>', Server: 'x' })
	})
})

describe('deviceDataForLog', () => {
	it('keeps only the sections the module parses', () => {
		const data = {
			Device: { AvioV2: { a: 1 }, AvMatrixRoutingV2: { b: 2 }, Ieee8021x: { Password: 'not for the log' } },
		}
		const logged = deviceDataForLog(data)
		expect(logged).toEqual({ Device: { AvioV2: { a: 1 }, AvMatrixRoutingV2: { b: 2 } }, omitted: ['Ieee8021x'] })
		expect(JSON.stringify(logged)).not.toContain('not for the log')
	})

	it('passes other responses through', () => {
		expect(deviceDataForLog('<html>')).toBe('<html>')
		expect(deviceDataForLog({ other: true })).toEqual({ other: true })
	})
})

describe('describeAxiosError', () => {
	// A rejected login, as axios builds it: the config holds the form body and the session cookie
	const config = {
		method: 'post',
		url: '/userlogin.html',
		data: 'login=companion&passwd=hunter2-secret',
		headers: new AxiosHeaders({ Cookie: 'TRACKID=abc123cookie' }),
	} as InternalAxiosRequestConfig
	const response = { data: '', status: 403, statusText: '', headers: new AxiosHeaders(), config } as AxiosResponse
	const err = new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, {}, response)

	it('summarises the failure without the password or cookies', () => {
		// What the module used to log
		expect(JSON.stringify(err)).toContain('hunter2-secret')

		const summary = describeAxiosError(err)
		expect(summary).toBe('POST /userlogin.html failed (ERR_BAD_REQUEST, HTTP 403): Request failed with status code 403')
		expect(summary).not.toContain('hunter2-secret')
		expect(summary).not.toContain('abc123cookie')
	})
})
