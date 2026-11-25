import type { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  const claims = event.requestContext.authorizer?.claims ?? {};

  // Used to test the CloudWatch alarm on purpose
  if (event.queryStringParameters?.fail === 'true') {
    console.error('Intentional test error triggered by', claims.email);
    throw new Error('Intentional test error for CloudWatch alarm');
  }

  const groups = String(claims['cognito:groups'] ?? '');
  console.log('Stats requested by', claims.email, 'groups:', groups);

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    body: JSON.stringify({
      message: 'Hello from the REST API (API Gateway + Lambda)',
      email: claims.email,
      groups,
      isAdmin: groups.includes('ADMINS'),
      serverTime: new Date().toISOString(),
    }),
  };
};
