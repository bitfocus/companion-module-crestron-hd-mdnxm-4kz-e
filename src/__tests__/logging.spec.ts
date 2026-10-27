import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { describeAxiosError, deviceDataForLog, redactHeaders } from '../logging.js'

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
