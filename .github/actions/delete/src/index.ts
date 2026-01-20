import { getNamespace } from "./get-namespace";
import { getServerlessFunction } from "./get-serverless-function";
import { deleteServerlessFunction } from "./delete-serverless-function";

const namespace = await getNamespace();
const serverlessFunction = await getServerlessFunction({ namespaceId: namespace.id });
await deleteServerlessFunction({ function_id: serverlessFunction.id })
