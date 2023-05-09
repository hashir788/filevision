import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";

import { RetrievalQAChain } from "langchain/chains";
import { json } from "stream/consumers";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const loader = new CSVLoader("public/2018.csv");
    const docs = await loader.load();
    const vectorStore = await MemoryVectorStore.fromDocuments(
      docs,
      new OpenAIEmbeddings()
    );
    const model = new OpenAI({
      openAIApiKey: OPENAI_API_KEY,
      maxTokens: 256,
      // temperature: 0.1,
    });
    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    const res = await chain.call({
      query: `Always try to provide answer with the dataset provided. You are supposed to answer questions from data provided. ${input}`,
    });

    return new Response(res.text);
  } catch (e) {
    console.log(e);
    return Response.error();
  }
}
