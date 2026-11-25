import { defineAuth, secret } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: { email: 'email' },
      },
      callbackUrls: ['http://localhost:5173/', 'https://main.ddg7per8ma76p.amplifyapp.com/'],
      logoutUrls: ['http://localhost:5173/', 'https://main.ddg7per8ma76p.amplifyapp.com/'],
    },
  },
  groups: ['ADMINS', 'USERS'],
  triggers: { postConfirmation },
  access: (allow) => [allow.resource(postConfirmation).to(['addUserToGroup'])],
});
