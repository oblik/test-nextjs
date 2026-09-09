/**
 * Checks whether a caught value is a Node.js system error with the given code,
 * e.g. `isErrno(error, 'ENOENT')`.
 */
export function isErrno(
	error: unknown,
	code: string
): error is NodeJS.ErrnoException {
	return Boolean(
		error && typeof error === 'object' && 'code' in error && error.code === code
	)
}
