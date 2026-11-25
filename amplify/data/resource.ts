import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Photo: a
    .model({
      title: a.string().required(),
      path: a.string().required(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
      allow.group('ADMINS'),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
