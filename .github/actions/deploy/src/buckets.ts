import { Function, createClient } from '@scaleway/sdk'

const client = createClient({
  accessKey: 'SCWXXXXXXXXXXXXXXXXX',
  secretKey: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  defaultProjectId: 'ae27d7c2-4a23-40f8-aa8b-15b28f6bb59f',
  defaultRegion: 'nl-ams',
  defaultZone: 'nl-ams-1',
})

const api = new Function.v1beta1.API(client);

api.listNamespaces();
