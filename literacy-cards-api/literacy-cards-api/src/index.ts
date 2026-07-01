export interface Env {
	DB: D1Database;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			if (path === '/api/images' && method === 'GET') {
				const { results } = await env.DB.prepare('SELECT * FROM cloud_images ORDER BY created_at DESC').all();
				return new Response(JSON.stringify(results), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (path === '/api/images/count' && method === 'GET') {
				const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM cloud_images').all();
				return new Response(JSON.stringify(results[0]), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (path === '/api/images' && method === 'POST') {
				const body = await request.json();
				await env.DB.prepare('INSERT INTO cloud_images (name, url, public_id, category) VALUES (?, ?, ?, ?)')
					.bind(body.name, body.url, body.public_id, body.category || '云端')
					.run();
				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (path.startsWith('/api/images/') && method === 'DELETE') {
				const public_id = decodeURIComponent(path.split('/').pop() || '');
				await env.DB.prepare('DELETE FROM cloud_images WHERE public_id = ?').bind(public_id).run();
				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			return new Response('Not Found', { status: 404, headers: corsHeaders });
		} catch (error: any) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};
