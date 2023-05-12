import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { OpenAI } from "langchain/llms/openai";

import { RetrievalQAChain } from "langchain/chains";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CSVToJSON = (data: any, delimiter = ",") => {
  const titles = data.slice(0, data.indexOf("\n")).split(delimiter);
  return data
    .slice(data.indexOf("\n") + 1)
    .split("\n")
    .map((v: any) => {
      const values = v.split(delimiter);
      return titles.reduce(
        (obj: any, title: any, index: any) => (
          (obj[title] = values[index]), obj
        ),
        {}
      );
    });
};

export async function POST(request: Request) {
  try {
    //Get the input data passed as Formdata
    const params = await request.formData();
    const doc = params.get("doc");
    const fileUrl = params.get("templateUrl");
    // console.log(fileUrl);

    //Load the Doc and CSV Template
    //First Step Download the Uploaded CSV Template
    const response = await fetch(fileUrl! as string);
    if (!response.ok) {
      return Response.error();
    }
    const csvBlob = await response.blob();
    // const csvLoader = new CSVLoader(csvBlob);
    // const csvData = await csvLoader.load();

    const text = await csvBlob.text();
    const preJson = CSVToJSON(text);
    let tjson = { ...preJson };

    //console.log(csvData);

    //Now Load the Doc File Sent From Front End
    const docLoader = new DocxLoader(doc!);
    const docData = await docLoader.load();

    //Create Vector Stores For Both Files
    const docVectorStore = await MemoryVectorStore.fromDocuments(
      docData,
      new OpenAIEmbeddings()
    );
    // const csvVectorStore = await MemoryVectorStore.fromDocuments(
    //   csvData,
    //   new OpenAIEmbeddings()
    // );

    //Initialize the Model (Open AI text-davinci-001 has been used)
    const model = new OpenAI({
      openAIApiKey: OPENAI_API_KEY,
      maxTokens: 256,
      // temperature: 0.1,
    });

    // const csvChain = RetrievalQAChain.fromLLM(
    //   model,
    //   csvVectorStore.asRetriever()
    // );
    // const csvRes = await csvChain.call({
    //   query: `Output the columns in the data wihtout any extra text or information, only from the available data`,
    // });

    // console.log(csvRes.text);
    const colData = await model.call(`
		Get the data fields from this ${JSON.stringify(
      tjson
    )}. Just output the data fields of this JSON onbject ignore
		the values and any extra inforamtion
	`);
    console.log("Column Data - " + colData);

    const docChain = RetrievalQAChain.fromLLM(
      model,
      docVectorStore.asRetriever()
    );

    // const docRes = await docChain.call({
    //   query: ` Get the headings and subtext from the data then use the
    //   headings as key and the subtext as value to create a JSON object.
    //   Just output the JSON object without any extra information
    //   `,
    // });
    const docRes = await docChain.call({
      query: `Analyse the given data and summarise the data relevant to ${colData} data fields.
	  If there's non matching heading or subtext in the data add those headings and fiedls
	  with relevant information as well. If you cannot add them igonore them and just return
	  the matching data.
      Output must be in JSON format, do not add any explainations or column names or any extra
      information just output the pure JSON format`,
    });
    console.log("Final Output " + JSON.stringify(docRes.text));

    const data = JSON.parse(docRes.text);
    return new Response(
      JSON.stringify({
        data: data,
        columns: colData,
      })
    );
  } catch (e) {
    console.log(e);
    return Response.error();
  }
}
