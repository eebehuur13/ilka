import type { Env, QueueMessage } from './types';
import { DocumentProcessor } from './processing/document-processor';
import { DocumentSummarizer } from './processing/summarizer';
import { ContextEnricher } from './processing/context-enricher';
import { DocumentEmbedder } from './processing/embedder';

export async function handleQueueMessage(
  batch: MessageBatch<QueueMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processMessage(message.body, env);
      message.ack();
    } catch (error) {
      console.error('Queue message processing failed:', error);
      message.retry();
    }
  }
}

async function processMessage(msg: QueueMessage, env: Env): Promise<void> {
  const { type, document_id, user_id } = msg;

  switch (type) {
    case 'process_document':
      const processor = new DocumentProcessor(env);
      await processor.processDocument(document_id);
      
      await env.QUEUE.send({
        type: 'generate_summary',
        document_id,
        user_id
      });
      break;

    case 'generate_summary':
      const summarizer = new DocumentSummarizer(env);
      await summarizer.generateSummary(document_id);
      
      await env.QUEUE.send({
        type: 'generate_contexts',
        document_id,
        user_id
      });
      break;

    case 'generate_contexts':
      const enricher = new ContextEnricher(env);
      await enricher.generateContexts(document_id);
      
      await env.QUEUE.send({
        type: 'generate_embeddings',
        document_id,
        user_id
      });
      break;

    case 'generate_embeddings':
      const embedder = new DocumentEmbedder(env);
      await embedder.embedDocument(document_id, user_id);
      break;

    case 'generate_embeddings_batch':
      const batchEmbedder = new DocumentEmbedder(env);
      await batchEmbedder.embedDocumentBatch(
        document_id,
        user_id,
        msg.start_index!,
        msg.end_index!,
        msg.batch_index!,
        msg.total_batches!
      );
      break;

    default:
      console.warn('Unknown queue message type:', type);
  }
}
