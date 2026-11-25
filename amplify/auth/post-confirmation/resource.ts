import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  runtime: 20,
  environment: { GROUP_NAME: 'USERS' },
  resourceGroupName: 'auth',
});
