import {
  aws_cloudwatch_actions,
  aws_codebuild,
  aws_codepipeline,
  aws_codepipeline_actions,
  aws_ec2,
  aws_ecr,
  aws_ecs,
  aws_ecs_patterns,
  aws_efs,
  aws_elasticloadbalancingv2,
  aws_logs,
  aws_rds,
  aws_secretsmanager,
  aws_sns,
  aws_sns_subscriptions,
  Duration,
  RemovalPolicy,
  Size,
  Stack,
  StackProps,
  Tags,
  Token
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Tags
    Tags.of(this).add('Cost Center', 'YOUR_NAME_HERE')
    Tags.of(this).add('Application', 'aws-training-api')
    Tags.of(this).add('Environment', 'production')

    // Networking
    const vpc = aws_ec2.Vpc.fromLookup(this, 'VPC', { vpcId: 'vpc-06bc4ed157210e75b' })
    const privateSubnets = [
      aws_ec2.Subnet.fromSubnetId(this, 'PrivateSubnet1', 'subnet-05082bd1c01e608cf'),
      aws_ec2.Subnet.fromSubnetId(this, 'PrivateSubnet2', 'subnet-0092bd5e67a7addb9'),
    ]
    const publicSubnets = [
      aws_ec2.Subnet.fromSubnetId(this, 'PublicSubnet1', 'subnet-04a984a3bb290baf1'),
      aws_ec2.Subnet.fromSubnetId(this, 'PublicSubnet2', 'subnet-0439d3437cdf3955f'),
    ]

    // Secrets
    const secretSecret = new aws_secretsmanager.Secret(this, 'Secret')
    const databasePasswordSecret = new aws_secretsmanager.Secret(
      this,
      'DatabasePassword',
      { generateSecretString: { excludePunctuation: true } }
    )

    // RDS
    const databaseUser = 'dbuser'
    const databaseName = 'api'
    const database = new aws_rds.DatabaseCluster(this, 'Database', {
      engine: aws_rds.DatabaseClusterEngine.auroraPostgres({ version: aws_rds.AuroraPostgresEngineVersion.VER_13_4 }),
      credentials: aws_rds.Credentials.fromPassword(databaseUser, databasePasswordSecret.secretValue),
      defaultDatabaseName: databaseName,
      instanceProps: {
        vpc,
        vpcSubnets: {
          subnets: privateSubnets,
        },
      },
    })

    // EFS
    const fileSystem = new aws_efs.FileSystem(this, 'FileSystem', {
      vpc,
      performanceMode: aws_efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: aws_efs.ThroughputMode.PROVISIONED,
      provisionedThroughputPerSecond: Size.mebibytes(10),
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const volume: aws_ecs.Volume = {
      name: 'Volume',
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
      },
    }

    // ECR
    const containerRegistry = new aws_ecr.Repository(this, 'ContainerRegistry', {
      removalPolicy: RemovalPolicy.DESTROY
    })

    // ECS
    var fargateLogGroup = new aws_logs.LogGroup(this, 'FargateLogs')
    const fargateService = new aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      vpc,
      taskImageOptions: {
        image: aws_ecs.ContainerImage.fromRegistry('kankje/aws-training-api:latest'),
        containerPort: 3000,
        environment: {
          DATABASE_HOST: database.clusterEndpoint.hostname,
          DATABASE_PORT: Token.asString(database.clusterEndpoint.port),
          DATABASE_USER: databaseUser,
          DATABASE_NAME: databaseName,
        },
        secrets: {
          SECRET: aws_ecs.Secret.fromSecretsManager(secretSecret),
          DATABASE_PASSWORD: aws_ecs.Secret.fromSecretsManager(databasePasswordSecret),
        },
        logDriver: aws_ecs.LogDriver.awsLogs({
          streamPrefix: 'logs',
          logGroup: fargateLogGroup
        })
      },
      cpu: 256,
      memoryLimitMiB: 512,
      loadBalancer: new aws_elasticloadbalancingv2.ApplicationLoadBalancer(this, 'LB', {
        vpc,
        vpcSubnets: {
          subnets: publicSubnets,
        },
        internetFacing: true,
      })
    })
    fargateService.targetGroup.configureHealthCheck({
      path: '/healthz',
    })

    // Mount EFS volume
    fargateService.taskDefinition.addVolume(volume)
    fargateService.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: '/app/data',
      sourceVolume: volume.name,
      readOnly: false
    })

    // Allow connections between ECS tasks <-> EFS filesystem
    fargateService.service.connections.allowFrom(fileSystem, aws_ec2.Port.tcp(2049))
    fargateService.service.connections.allowTo(fileSystem, aws_ec2.Port.tcp(2049))

    // Allow connections between ECS tasks <-> RDS database
    fargateService.service.connections.allowFrom(database, aws_ec2.Port.tcp(5432))
    fargateService.service.connections.allowTo(database, aws_ec2.Port.tcp(5432))

    // CodeBuild
    const buildProject = new aws_codebuild.PipelineProject(this, 'BuildProject', {
      buildSpec: aws_codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      environment: {
        privileged: true,
      },
      environmentVariables: {
        REPOSITORY_URI: {
          value: containerRegistry.repositoryUri
        }
      }
    })

    // CodePipeline
    const sourceArtifact = new aws_codepipeline.Artifact()
    const imageDefinitionArtifact = new aws_codepipeline.Artifact()
    new aws_codepipeline.Pipeline(
      this,
      'Pipeline',
      {
        crossAccountKeys: false,
        stages: [
          // 1. Pull source from GitHub
          {
            stageName: 'Source',
            actions: [
              new aws_codepipeline_actions.CodeStarConnectionsSourceAction({
                actionName: 'Source',
                connectionArn: 'arn:aws:codestar-connections:eu-west-1:571964155577:connection/5f1df821-227e-4a47-814c-965e8ca38942',
                owner: 'kankje',
                repo: 'aws-training-api',
                branch: 'production',
                output: sourceArtifact
              })
            ]
          },

          // 2. Build and push Docker image to ECR
          {
            stageName: 'Build',
            actions: [
              new aws_codepipeline_actions.CodeBuildAction({
                actionName: 'Build',
                input: sourceArtifact,
                project: buildProject,
                outputs: [imageDefinitionArtifact]
              })
            ]
          },

          // 3. Deploy image to ECS
          {
            stageName: 'Deploy',
            actions: [
              new aws_codepipeline_actions.ManualApprovalAction({
                actionName: 'Approve',
              }),
              new aws_codepipeline_actions.EcsDeployAction({
                actionName: 'Deploy',
                input: imageDefinitionArtifact,
                service: fargateService.service
              })
            ]
          }
        ]
      }
    )

    // Allow CodeBuild to read and write images to the ECR registry
    aws_ecr.AuthorizationToken.grantRead(buildProject)
    containerRegistry.grantPullPush(buildProject)

    // Allow ECS to read images from the ECR registry
    aws_ecr.AuthorizationToken.grantRead(fargateService.service.taskDefinition.executionRole!)
    containerRegistry.grantPull(fargateService.service.taskDefinition.executionRole!)

    // CloudWatch alarm for all logged messages containing "Error"
    const errorFilter = new aws_logs.MetricFilter(this, 'ErrorFilter', {
      logGroup: fargateLogGroup,
      metricNamespace: `${this.stackName}Metrics`,
      metricName: 'Errors',
      filterPattern: aws_logs.FilterPattern.anyTerm('Error')
    })
    const errorAlarm = errorFilter
      .metric({ period: Duration.seconds(30), statistic: 'Sum' })
      .createAlarm(this, 'Alarm', {
        threshold: 1,
        evaluationPeriods: 1,
      })

    // SNS topic for alarm notifications
    const alarmTopic = new aws_sns.Topic(this, 'AlarmTopic')
    alarmTopic.addSubscription(
      new aws_sns_subscriptions.EmailSubscription('YOUR_EMAIL_HERE')
    )
    errorAlarm.addAlarmAction(
      new aws_cloudwatch_actions.SnsAction(alarmTopic)
    )
  }
}
