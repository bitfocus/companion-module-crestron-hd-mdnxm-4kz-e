import { describe, expect, it } from 'vitest'
import axios, { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { ZodError } from 'zod'
import { shouldRetryConnection } from '../errors.js'

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
