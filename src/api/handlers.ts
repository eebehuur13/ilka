import type { Env, UploadRequest, QueryRequest, QueryResponse, QueryAnalysis, RetrievalMethod } from '../types';
import { QueryAnalyzer } from '../query/analyzer';
import { Router } from '../query/router';
import { Method1BM25Direct } from '../methods/method1-bm25-direct';
import { Method2BM25Agents } from '../methods/method2-bm25-agents';
import { Method3VectorAgents } from '../methods/method3-vector-agents';
import { Method4HydeAgents } from '../methods/method4-hyde-agents';
import { MethodSummary } from '../methods/method-summary';
import { VectorRetriever } from '../retrieval/vector';
import { GeminiClient } from '../llm/gemini-client';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  try {
    const body: UploadRequest = await request.json();
    const { file_name, content, user_id } = body;

    if (!file_name || !content || !user_id) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const documentId = crypto.randomUUID();
    const fileSize = new TextEncoder().encode(content).length;
    
    await env.STORAGE.put(`${user_id}/${documentId}.txt`, content);

    await env.DB
      .prepare(`
        INSERT INTO documents (id, file_name, file_type, user_id, upload_date, status, full_text, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(documentId, file_name, 'text/plain', user_id, Date.now(), 'processing', content, fileSize)
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
    const { query, user_id, mode, reasoning = false } = body;

    console.log('[DEBUG] Query received:', { query: query.substring(0, 50), mode, reasoning });

    if (!query || !user_id) {
      return jsonResponse({ error: 'Missing query or user_id' }, 400);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming response in background
    (async () => {
      try {
        // Handle file-search mode
        if (mode === 'file-search') {
          let analysis;
          try {
            const analyzer = new QueryAnalyzer(env);
            analysis = await analyzer.analyze(query);
          } catch (error) {
            console.error('Analyzer failed:', error);
            // Use fallback analysis
            analysis = {
              intent: 'factual' as const,
              complexity: 'moderate' as const,
              target_type: 'general' as const,
              target_document: null,
              synonyms: [],
              related_terms: [],
              rephrasings: [query],
              hypothetical_answer: '',
              recommended_methods: ['bm25', 'vector'] as const,
              reasoning: 'Using fallback due to analyzer error',
              sub_questions: null
            } as QueryAnalysis;
          }

          // Send analysis complete
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'analysis_complete', 
                analysis 
              })}\n\n`
            )
          );

          const router = new Router();
          const methods = router.route(analysis);
          
          const expandedMethods = methods.flatMap(method => 
            (method as string) === 'all' ? ['bm25', 'vector', 'hyde'] as RetrievalMethod[] : [method]
          );

          // Send methods planned
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'methods_planned', 
                methods: expandedMethods 
              })}\n\n`
            )
          );

          // Execute methods progressively
          const methodExecutors = expandedMethods.map(async (method) => {
            const startTime = Date.now();
            try {
              let result = null;
              
              switch (method) {
                case 'bm25':
                  const method1 = new Method1BM25Direct(env);
                  result = await method1.execute(query, analysis, user_id);
                  break;
                
                case 'vector':
                  const method3 = new Method3VectorAgents(env);
                  result = await method3.execute(query, analysis, user_id);
                  break;
                
                case 'hyde':
                  const method4 = new Method4HydeAgents(env);
                  result = await method4.execute(query, analysis, user_id);
                  break;
                
                case 'summary':
                  const summaryMethod = new MethodSummary(env);
                  result = await summaryMethod.execute(query, analysis, user_id);
                  break;
                
                default:
                  console.warn('Unknown retrieval method:', method);
                  return;
              }

              if (result) {
                // Stream method completion
                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({ 
                      type: 'method_complete', 
                      method: result.method,
                      answer: result
                    })}\n\n`
                  )
                );
              }
            } catch (error) {
              console.error(`Method ${method} failed:`, error);
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({ 
                    type: 'method_error', 
                    method,
                    error: (error as Error).message 
                  })}\n\n`
                )
              );
            }
          });

          // Wait for all methods to complete
          await Promise.allSettled(methodExecutors);

          // Add Method2 BM25 Agents if bm25 was used
          if (expandedMethods.includes('bm25')) {
            try {
              const method2 = new Method2BM25Agents(env);
              const agentAnswer = await method2.execute(query, analysis, user_id);
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({ 
                    type: 'method_complete', 
                    method: agentAnswer.method,
                    answer: agentAnswer
                  })}\n\n`
                )
              );
            } catch (error) {
              console.error('Method2 BM25 Agents failed:', error);
            }
          }

          // Send completion
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done' })}\n\n`
            )
          );

          return;
        }

        // Handle model-only mode with Gemini
        const gemini = new GeminiClient(env.GEMINI_API_KEY);
        
        // Configure thinking based on reasoning toggle
        const thinkingBudget = reasoning ? -1 : 0; // -1 = dynamic, 0 = disabled
        console.log('[DEBUG] Model-only stream - thinkingBudget:', thinkingBudget, 'reasoning:', reasoning);

        try {
          for await (const chunk of gemini.streamContent(query, {
            thinkingBudget,
            includeThoughts: reasoning,
            temperature: 0.7,
            maxTokens: 2000,
          })) {
            if (chunk.type === 'thinking') {
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({ 
                    type: 'thinking', 
                    text: chunk.content 
                  })}\n\n`
                )
              );
            } else {
              await writer.write(
                encoder.encode(
                  `data: ${JSON.stringify({ 
                    type: 'answer', 
                    text: chunk.content 
                  })}\n\n`
                )
              );
            }
          }
        } catch (geminiError) {
          console.error('Gemini streaming error:', geminiError);
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'error', 
                message: 'Failed to generate response' 
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
    const { query, user_id, methods: requestedMethods, mode, reasoning = false } = body;

    if (!query || !user_id) {
      return jsonResponse({ error: 'Missing query or user_id' }, 400);
    }

    const startTime = Date.now();

    // Handle model-only mode: Skip all retrieval, just use Gemini
    if (mode === 'model-only') {
      const gemini = new GeminiClient(env.GEMINI_API_KEY);
      const thinkingBudget = reasoning ? -1 : 0;
      console.log('[DEBUG] Model-only non-stream - thinkingBudget:', thinkingBudget, 'reasoning:', reasoning);
      
      const result = await gemini.generateContent(query, {
        thinkingBudget,
        includeThoughts: reasoning,
        temperature: 0.7,
        maxTokens: 2000,
      });

      return jsonResponse({
        query,
        analysis: null,
        answers: [{
          method: 'model-only',
          text: result.answer,
          citations: [],
          confidence: 'high' as const,
          latency_ms: Date.now() - startTime,
          metadata: reasoning && result.thinking ? { thinking: result.thinking } : undefined
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
      (method as string) === 'all' ? ['bm25', 'vector', 'hyde'] as RetrievalMethod[] : [method]
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
            const summaryMethod = new MethodSummary(env);
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
      .prepare('SELECT id, file_name, status, chunk_count, upload_date, file_size FROM documents WHERE user_id = ? ORDER BY upload_date DESC')
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
      await vectorRetriever.deleteDocumentVectors(documentId, `user-${userId}`);
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
