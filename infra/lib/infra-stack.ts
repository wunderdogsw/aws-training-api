import {
  aws_ec2,
  aws_ecs,
  aws_ecs_patterns,
  aws_efs,
  aws_elasticloadbalancingv2,
  aws_rds,
  aws_secretsmanager, CfnOutput,
  Size,
  Stack,
  StackProps, Token
} from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

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
    const databasePasswordSecret = new aws_secretsmanager.Secret(this, 'DatabasePassword')

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

    const fileSystem = new aws_efs.FileSystem(this, 'Filesystem', {
      vpc: vpc,
      performanceMode: aws_efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: aws_efs.ThroughputMode.PROVISIONED,
      provisionedThroughputPerSecond: Size.mebibytes(10),
    })

    const volume: aws_ecs.Volume = {
      name: 'Volume',
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
      },
    }

    // ECS

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

    // Grant access to secrets

    if (!fargateService.taskDefinition.executionRole) {
      throw new Error('Task definition execution role not set')
    }

    secretSecret.grantRead(fargateService.taskDefinition.executionRole)

    // Mount EFS volume

    fargateService.taskDefinition.addVolume(volume)
    fargateService.taskDefinition.defaultContainer?.addMountPoints({
      containerPath: '/app/data',
      sourceVolume: volume.name,
      readOnly: false,
    })

    // Allow connections between ECS tasks <-> EFS filesystem

    fargateService.service.connections.allowFrom(fileSystem, aws_ec2.Port.tcp(2049))
    fargateService.service.connections.allowTo(fileSystem, aws_ec2.Port.tcp(2049))

    // Allow connections between ECS tasks <-> RDS database

    fargateService.service.connections.allowFrom(database, aws_ec2.Port.tcp(5432))
    fargateService.service.connections.allowTo(database, aws_ec2.Port.tcp(5432))

    // Outputs

    new CfnOutput(this, 'EcsClusterName', { value: fargateService.cluster.clusterName })
    new CfnOutput(this, 'EcsServiceName', { value: fargateService.service.serviceName })
  }
}
