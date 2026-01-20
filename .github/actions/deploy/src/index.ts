import { getNamespace } from "./get-namespace";
import { createNamespace } from "./create-namespace";
import { getServerlessFunction } from "./get-serverless-function";
import { createServerlessFunction } from "./create-serverless-function";
import { uploadServerlessFunction } from "./upload-serverless-function";
import { deployServerlessFunction } from "./deploy-serverless-function";

let namespace = await getNamespace();

if(!namespace) {
  namespace = await createNamespace();
}

let serverlessFunction = await getServerlessFunction({ namespaceId: namespace.id });

if (!serverlessFunction) {
  serverlessFunction = await createServerlessFunction({ namespaceId: namespace.id });
}

if (serverlessFunction) {
  await uploadServerlessFunction({ functionId: serverlessFunction.id});
  await deployServerlessFunction({ functionId: serverlessFunction.id});
}
