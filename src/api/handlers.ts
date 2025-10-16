import type { Env, UploadRequest, QueryRequest, QueryResponse } from '../types';
import { QueryAnalyzer } from '../query/analyzer';
import { Router } from '../query/router';
import { Method1BM25Direct } from '../methods/method1-bm25-direct';
import { Method2BM25Agents } from '../methods/method2-bm25-agents';
import { Method3VectorAgents } from '../methods/method3-vector-agents';
import { Method4HydeAgents } from '../methods/method4-hyde-agents';
import { VectorRetriever } from '../retrieval/vector';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  try {
    const body: UploadRequest = await request.json();
    const { file_name, content, user_id } = body;

    if (!file_name || !content || !user_id) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const documentId = crypto.randomUUID();
    
    await env.STORAGE.put(`${user_id}/${documentId}.txt`, content);

    await env.DB
      .prepare(`
        INSERT INTO documents (id, file_name, file_type, user_id, upload_date, status, full_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(documentId, file_name, 'text/plain', user_id, Date.now(), 'processing', content)
      .run();

    await env.QUEUE.send({
      type: 'process_document',
      document_id: documentId,
      user_id
    });

    return jsonResponse({
      document_id: documentId,
      status: 'processing',
      message: 'Document uploaded successfully. Processing will complete in ~15-20 seconds.'
    }, 201);
  } catch (error: any) {
    console.error('Upload error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function handleQueryStream(request: Request, env: Env): Promise<Response> {
  try {
    const body: QueryRequest = await request.json();
    const { query, user_id, mode } = body;

    if (!query || !user_id) {
      return jsonResponse({ error: 'Missing query or user_id' }, 400);
    }

    // Only support model-only mode for streaming
    if (mode !== 'model-only') {
      return jsonResponse({ error: 'Streaming only supports model-only mode' }, 400);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming response in background
    (async () => {
      try {
        const systemPrompt = `You are a helpful assistant. Always structure your response in two clear sections:

THINKING:
[Write your step-by-step reasoning and analysis here. Show your thought process.]

ANSWER:
[Write your final, concise answer here.]

Always use exactly these section headers: "THINKING:" and "ANSWER:"`;

        const response = await env.AI.run('@cf/openai/gpt-oss-120b', {
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          stream: true,
          max_output_tokens: 2000,
          temperature: 0.7
        });

        let buffer = '';
        let currentSection: 'thinking' | 'answer' | 'initial' = 'initial';
        let thinkingComplete = false;

        // Stream tokens as they arrive
        for await (const chunk of response as any) {
          const text = chunk.response || '';
          buffer += text;

          // Detect ANSWER: transition
          if (!thinkingComplete && buffer.includes('ANSWER:')) {
            const parts = buffer.split('ANSWER:');
            const thinkingText = parts[0].replace('THINKING:', '').trim();
            
            // Send complete thinking section
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'thinking_complete', 
                  text: thinkingText 
                })}\n\n`
              )
            );
            
            thinkingComplete = true;
            currentSection = 'answer';
            buffer = parts[1] || '';
            
            // Send start of answer
            if (buffer) {
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({ 
                    type: 'answer', 
                    text: buffer 
                  })}\n\n`
                )
              );
            }
            continue;
          }

          // Stream current section
          if (currentSection === 'initial' && text) {
            // Still in thinking section
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'thinking', 
                  text: text 
                })}\n\n`
              )
            );
          } else if (currentSection === 'answer' && text) {
            // Streaming answer
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'answer', 
                  text: text 
                })}\n\n`
              )
            );
          }
        }

        // If we never found ANSWER:, treat everything as answer
        if (!thinkingComplete && buffer) {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'answer', 
                text: buffer 
              })}\n\n`
            )
          );
        }

        // Send completion
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done' })}\n\n`
          )
        );

      } catch (error: any) {
        console.error('Streaming error:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'error', 
              message: error.message 
            })}\n\n`
          )
        );
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no'
      }
    });

  } catch (error: any) {
    console.error('Stream setup error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    const body: QueryRequest = await request.json();
    const { query, user_id, methods: requestedMethods, mode } = body;

    if (!query || !user_id) {
      return jsonResponse({ error: 'Missing query or user_id' }, 400);
    }

    const startTime = Date.now();

    // Handle model-only mode: Skip all retrieval, just use LLM
    if (mode === 'model-only') {
      const response = await env.AI.run('@cf/openai/gpt-oss-120b', {
        input: [{ role: 'user', content: query }],
        max_output_tokens: 2000,
        temperature: 0.7
      });

      const text = (response as any).output?.[0]?.content?.[0]?.text || (response as any).response || '';

      return jsonResponse({
        query,
        analysis: null,
        answers: [{
          method: 'model-only',
          text,
          citations: [],
          confidence: 'high' as const,
          latency_ms: Date.now() - startTime
        }],
        total_latency_ms: Date.now() - startTime
      });
    }

    // File-search mode: Run retrieval methods
    const analyzer = new QueryAnalyzer(env);
    const analysis = await analyzer.analyze(query);

    const router = new Router();
    const methods = requestedMethods || router.route(analysis);

    // Handle 'all' method - expand to all available methods
    const expandedMethods = methods.flatMap(method => 
      method === 'all' ? ['bm25', 'vector', 'hyde'] : [method]
    );

    const results = await Promise.all(
      expandedMethods.map(async (method) => {
        switch (method) {
          case 'bm25':
            const method1 = new Method1BM25Direct(env);
            return await method1.execute(query, analysis, user_id);
          
          case 'vector':
            const method3 = new Method3VectorAgents(env);
            return await method3.execute(query, analysis, user_id);
          
          case 'hyde':
            const method4 = new Method4HydeAgents(env);
            return await method4.execute(query, analysis, user_id);
          
          case 'summary':
            // TODO: Implement document summary method
            // For now, fall back to BM25 direct
            const summaryMethod = new Method1BM25Direct(env);
            return await summaryMethod.execute(query, analysis, user_id);
          
          default:
            console.warn('Unknown retrieval method:', method);
            return null;
        }
      })
    );

    const answers = results.filter(r => r !== null);

    if (methods.includes('bm25') && !requestedMethods) {
      const method2 = new Method2BM25Agents(env);
      const agentAnswer = await method2.execute(query, analysis, user_id);
      answers.push(agentAnswer);
    }

    const response: QueryResponse = {
      query,
      analysis,
      answers,
      total_latency_ms: Date.now() - startTime
    };

    return jsonResponse(response);
  } catch (error: any) {
    console.error('Query error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function handleListDocuments(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      return jsonResponse({ error: 'Missing user_id' }, 400);
    }

    const result = await env.DB
      .prepare('SELECT id, file_name, status, chunk_count, upload_date FROM documents WHERE user_id = ? ORDER BY upload_date DESC')
      .bind(userId)
      .all();

    return jsonResponse({ documents: result.results || [] });
  } catch (error: any) {
    console.error('List documents error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function handleDeleteDocument(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const documentId = url.pathname.split('/').pop();
    const userId = url.searchParams.get('user_id');

    if (!documentId || !userId) {
      return jsonResponse({ error: 'Missing document_id or user_id' }, 400);
    }

    const doc = await env.DB
      .prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
      .bind(documentId, userId)
      .first();

    if (!doc) {
      return jsonResponse({ error: 'Document not found' }, 404);
    }

    // Delete vectors FIRST (before D1 cascade deletes passage records)
    const vectorRetriever = new VectorRetriever(env.VECTORIZE, env.OPENAI_API_KEY, env.DB);
    try {
      await vectorRetriever.deleteDocumentVectors(documentId);
    } catch (error) {
      console.error('Failed to delete vectors:', error);
      // Continue with deletion even if vector cleanup fails
    }

    // Delete from R2 storage
    await env.STORAGE.delete(`${userId}/${documentId}.txt`);

    // Delete from D1 (cascades to passages, contexts, etc.)
    await env.DB
      .prepare('DELETE FROM documents WHERE id = ?')
      .bind(documentId)
      .run();

    return jsonResponse({ message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('Delete error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function handleGetStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const documentId = url.pathname.split('/').pop();

    if (!documentId) {
      return jsonResponse({ error: 'Missing document_id' }, 400);
    }

    const doc = await env.DB
      .prepare('SELECT id, file_name, status, chunk_count FROM documents WHERE id = ?')
      .bind(documentId)
      .first();

    if (!doc) {
      return jsonResponse({ error: 'Document not found' }, 404);
    }

    return jsonResponse(doc);
  } catch (error: any) {
    console.error('Status error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
