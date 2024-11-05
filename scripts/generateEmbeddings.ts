import pLimit from 'p-limit';
import { updateProgress } from '../lib/progressStore'; // Import the updateProgress function
import { JiraIssue, PineconeVector } from '@/types/types';
import openai from '@/lib/openaiClient';
import { OPENAI_EMBEDDING_MODEL } from '@/config';

export async function generateEmbeddings(issues: JiraIssue[]): Promise<PineconeVector[]> {
  const embeddings: PineconeVector[] = [];
  const limit = pLimit(5); // Limit to 5 concurrent requests (adjust as needed)

  const promises = issues.map((issue) =>
    limit(async () => {
      const text = `${issue.fields.summary}\n${issue.fields.description || ''}`;
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: OPENAI_EMBEDDING_MODEL,
          input: text,
        });
        const embedding = embeddingResponse.data[0].embedding;
        embeddings.push({
          id: issue.key,
          values: embedding,
          metadata: {
            issueKey: issue.key,
            summary: issue.fields.summary,
            description: issue.fields.description || '',
            issuetype: issue.fields.issuetype.name,
            parentKey: issue.fields.parent?.key || '',
          },
        });
        updateProgress(); // Update progress after each embedding is generated
      } catch (error) {
        console.error(`Error generating embedding for issue ${issue.key}:`, error);
        // Optionally handle errors (e.g., retry or skip the issue)
      }
    })
  );

  await Promise.all(promises);
  return embeddings;
}
