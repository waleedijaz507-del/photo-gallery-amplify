import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'photoGallery',
  access: (allow) => ({
    'photos/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
      allow.groups(['ADMINS']).to(['read', 'write', 'delete']),
    ],
  }),
});
