import { defineBackend } from '@aws-amplify/backend';
import { Duration, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { statsFunction } from './functions/stats/resource';

const backend = defineBackend({ auth, data, storage, statsFunction });

// ---------- S3 permissions for the USERS group ----------
// A user in a Cognito group gets that group's IAM role, not the general "authenticated" role,
// so the USERS role needs its own S3 permissions.
const bucket = backend.storage.resources.bucket;

backend.auth.resources.groups['USERS'].role.attachInlinePolicy(
  new Policy(Stack.of(bucket), 'UsersGroupPhotoPolicy', {
    statements: [
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [bucket.arnForObjects('photos/*')],
      }),
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        // Normal quotes on purpose: AWS (not TypeScript) fills in the signed-in user's identity ID
        resources: [bucket.arnForObjects('photos/${cognito-identity.amazonaws.com:sub}/*')],
      }),
    ],
  }),
);

// ---------- REST API: API Gateway + Lambda, protected by Cognito ----------
const apiStack = backend.createStack('rest-api-stack');

const restApi = new RestApi(apiStack, 'PhotoRestApi', {
  restApiName: 'photoRestApi',
  deploy: true,
  deployOptions: { stageName: 'prod' },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: Cors.DEFAULT_HEADERS,
  },
});

const authorizer = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuthorizer', {
  cognitoUserPools: [backend.auth.resources.userPool],
});

restApi.root
  .addResource('stats')
  .addMethod('GET', new LambdaIntegration(backend.statsFunction.resources.lambda), {
    authorizationType: AuthorizationType.COGNITO,
    authorizer,
  });

backend.addOutput({
  custom: {
    API: {
      [restApi.restApiName]: {
        endpoint: restApi.url,
        region: Stack.of(restApi).region,
        apiName: restApi.restApiName,
      },
    },
  },
});

// ---------- Monitoring: CloudWatch alarm + dashboard ----------
const monitoringStack = backend.createStack('monitoring-stack');
const statsLambda = backend.statsFunction.resources.lambda;

const alarmTopic = new sns.Topic(monitoringStack, 'AlarmTopic');
alarmTopic.addSubscription(new subs.EmailSubscription('waleedijaz507@gmail.com'));

const errorAlarm = new cloudwatch.Alarm(monitoringStack, 'StatsLambdaErrorAlarm', {
  alarmDescription: 'Stats Lambda returned one or more errors',
  metric: statsLambda.metricErrors({ period: Duration.minutes(1) }),
  threshold: 1,
  evaluationPeriods: 1,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
errorAlarm.addAlarmAction(new cwActions.SnsAction(alarmTopic));

new cloudwatch.Dashboard(monitoringStack, 'PhotoGalleryDashboard', {
  dashboardName: 'PhotoGalleryDashboard',
  widgets: [
    [
      new cloudwatch.GraphWidget({
        title: 'Stats Lambda: invocations & errors',
        left: [statsLambda.metricInvocations(), statsLambda.metricErrors()],
      }),
      new cloudwatch.GraphWidget({
        title: 'Stats Lambda: duration (ms)',
        left: [statsLambda.metricDuration()],
      }),
    ],
    [
      new cloudwatch.GraphWidget({
        title: 'REST API: requests, 4XX, 5XX',
        left: [restApi.metricCount(), restApi.metricClientError(), restApi.metricServerError()],
      }),
      new cloudwatch.AlarmWidget({ title: 'Error alarm', alarm: errorAlarm }),
    ],
  ],
});
