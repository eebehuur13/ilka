import type { Env, QueueMessage } from './types';
import {
  handleUpload,
  handleQuery,
  handleQueryStream,
  handleListDocuments,
  handleDeleteDocument,
  handleGetStatus
} from './api/handlers';
import { handleQueueMessage } from './queue-consumer';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      if (pathname === '/upload' && method === 'POST') {
        response = await handleUpload(request, env);
      } else if (pathname === '/query/stream' && method === 'POST') {
        response = await handleQueryStream(request, env);
      } else if (pathname === '/query' && method === 'POST') {
        response = await handleQuery(request, env);
      } else if (pathname === '/documents' && method === 'GET') {
        response = await handleListDocuments(request, env);
      } else if (pathname.startsWith('/documents/') && method === 'DELETE') {
        response = await handleDeleteDocument(request, env);
      } else if (pathname.startsWith('/status/') && method === 'GET') {
        response = await handleGetStatus(request, env);
      } else if (pathname === '/' && method === 'GET') {
        response = new Response(JSON.stringify({
          name: 'Ilka',
          version: '1.0.0',
          description: 'Advanced knowledge platform with 4 retrieval methods',
          endpoints: {
            upload: 'POST /upload',
            query: 'POST /query',
            list: 'GET /documents?user_id=xxx',
            delete: 'DELETE /documents/:id?user_id=xxx',
            status: 'GET /status/:id'
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error: any) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error', message: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    await handleQueueMessage(batch, env);
  }
};
