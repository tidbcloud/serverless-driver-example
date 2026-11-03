// This example authenticates one trusted service identity, not individual users.
export async function authenticate(request: Request, token: string | undefined): Promise<Response | undefined> {
	if (!token || token.trim().length < 32) {
		return new Response('Service unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
	}

	const bearer = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(request.headers.get('Authorization') ?? '');
	let valid = false;
	if (bearer) {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw', encoder.encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
		);
		// Web Crypto verifies the MAC without a secret-dependent string comparison.
		const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
		valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(bearer[1]));
	}

	if (!valid) {
		return new Response('Unauthorized', {
			status: 401,
			headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' },
		});
	}
}
