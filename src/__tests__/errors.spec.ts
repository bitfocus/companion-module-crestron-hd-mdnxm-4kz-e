import { describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { ZodError } from 'zod'
import { handleError, shouldRetryConnection } from '../errors.js'
import type ModuleInstance from '../main.js'

function httpError(status: number): AxiosError {
	const response = { data: '', status, statusText: '', headers: new AxiosHeaders(), config: {} } as AxiosResponse
	return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', undefined, {}, response)
}

const ERRORS: Array<[string, unknown]> = [
	['no response', new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', undefined, {})],
	['a timeout with no response', new AxiosError('timeout of 0ms exceeded', 'ECONNABORTED', undefined, {})],
	['200 with an error code', httpError(200)],
	['301', httpError(301)],
	['401', httpError(401)],
	['403', httpError(403)],
	['404', httpError(404)],
	['500', httpError(500)],
	['503', httpError(503)],
	['a schema failure', new ZodError([])],
	['an abort', new DOMException('This operation was aborted', 'AbortError')],
	['an Error', new Error('boom')],
	['a string', 'boom'],
]

/** The rule the module used for every connection failure before the credentials-sent split */
const originalRule = (err: unknown): boolean => axios.isAxiosError(err) && err.response === undefined

describe('shouldRetryConnection', () => {
	it.each(ERRORS)('retries %s before the credentials are sent', (_name, err) => {
		expect(shouldRetryConnection(err, false)).toBe(true)
	})

	// Never sends the credentials more often than before, whatever the device answers
	it.each(ERRORS)('decides %s exactly as before once the credentials are sent', (_name, err) => {
		expect(shouldRetryConnection(err, true)).toBe(originalRule(err))
	})

	it('still retries only failures that got no response once the credentials are sent', () => {
		const retried = ERRORS.filter(([, err]) => shouldRetryConnection(err, true)).map(([name]) => name)
		expect(retried).toEqual(['no response', 'a timeout with no response'])
	})
})

describe('handleError', () => {
	function fakeInstance() {
		const log = vi.fn<(level: string, message: string) => void>()
		const debug = vi.fn<(msg: string | object) => void>()
		const instance = { log, debug, statusManager: { updateStatus: vi.fn() } } as unknown as ModuleInstance
		return { instance, log, debug }
	}

	it('does not put the request config, with the password and cookies, in the debug log', () => {
		const { instance, debug } = fakeInstance()
		const config = {
			method: 'post',
			url: '/userlogin.html',
			data: 'login=companion&passwd=hunter2-secret',
			headers: new AxiosHeaders({ Cookie: 'TRACKID=abc123cookie' }),
		} as InternalAxiosRequestConfig
		const response = { data: '', status: 403, statusText: '', headers: new AxiosHeaders(), config } as AxiosResponse
		handleError(
			new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', config, {}, response),
			instance,
		)

		const logged = JSON.stringify(debug.mock.calls)
		expect(logged).toContain('POST /userlogin.html failed')
		expect(logged).not.toContain('hunter2-secret')
		expect(logged).not.toContain('abc123cookie')
	})
})
