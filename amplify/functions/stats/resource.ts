import { defineFunction } from '@aws-amplify/backend';

export const statsFunction = defineFunction({
  name: 'stats-function',
  runtime: 20,
  entry: './handler.ts',
});
