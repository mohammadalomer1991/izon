import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import type * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type * as rds from "aws-cdk-lib/aws-rds";
import type * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import type { Stage } from "../../types/stage";
import { createResourceName } from "../../utils/create-resorce-name";
import { getDomainName } from "../../utils/get-domain-name";
import { localEnvironmentConfig } from "../../utils/local-env";

interface EcsProps {
	stage: Stage;
	vpc: ec2.Vpc;
	rdsCluster: rds.DatabaseCluster;
	rdsPort: number;
	ecrRepository: ecr.IRepository;
	ecsSg: ec2.SecurityGroup;
	albSg: ec2.SecurityGroup;
	applicationBucket: s3.IBucket;
}

/**
 * 各環境のECSタスク定義設定インターフェース
 */
interface EcsTaskSpecification {
	memoryLimitMiB: number;
	cpu: number;
}

/**
 * ECS Construct
 *
 * ECSクラスターとFargateサービスを構築
 * アプリケーション用とバッチ処理用のECSクラスターを作成
 */
export class Ecs extends Construct {
	public readonly cluster: ecs.Cluster;
	public readonly fargateTaskDefinition: ecs.FargateTaskDefinition;
	public readonly service: ecs.FargateService;
	public readonly batchCluster: ecs.Cluster;
	public readonly batchTaskDefinition: ecs.FargateTaskDefinition;
	public readonly batchService: ecs.FargateService;

	constructor(scope: Construct, id: string, props: EcsProps) {
		super(scope, id);

		// アプリケーション用のECSクラスタ
		// 注：Batch処理用のECSクラスタは別途作成
		this.cluster = new ecs.Cluster(this, "cluster", {
			vpc: props.vpc,
			containerInsightsV2: ecs.ContainerInsights.ENABLED,
		});

		// 環境ごとのECSスペックを取得（アプリケーション、バッチ共通）
		const ecsSpec = this.getTaskSpecificationForStage(props.stage);

		// タスク定義を作成
		this.fargateTaskDefinition = new ecs.FargateTaskDefinition(
			this,
			"task-definition",
			ecsSpec,
		);

		// InferenceAccelerators警告の解消
		const cfnAppTaskDef = this.fargateTaskDefinition.node
			.defaultChild as ecs.CfnTaskDefinition;
		cfnAppTaskDef.addDeletionOverride("Properties.InferenceAccelerators");

		// Cloudwatch Logs用のロググループを作成
		const logGroup = new logs.LogGroup(this, "ecs-log-group", {
			logGroupName: createResourceName(props.stage, "ecs-app-logs"),
			retention: logs.RetentionDays.ONE_YEAR,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		// 環境変数をstageに応じて設定
		let env = {};
		if (props.stage === "local") {
			env = {
				APP_NAME: "izon_local",
				APP_ENV: "aws_local",
				APP_KEY: "base64:0nf03w7jN9tcajSVHcJfQRvgBu8ubydiuNfeYRawDeQ=",
				APP_URL: localEnvironmentConfig.appHost,
				ASSET_URL: localEnvironmentConfig.appHost,
				DB_CONNECTION: "pgsql",
				DB_HOST: props.rdsCluster.clusterEndpoint.hostname,
				DB_PORT: props.rdsPort.toString(),
				DB_DATABASE: "izondb",
				DB_USERNAME: "postgres",
				LOG_CHANNEL: "stderr",
			};
		}
		if (props.stage === "dev") {
			env = {
				APP_NAME: "izon_dev",
				APP_ENV: "aws_dev",
				APP_KEY: "base64:0nf03w7jN9tcajSVHcJfQRvgBu8ubydiuNfeYRawDeQ=",
				APP_URL: `https://${getDomainName(props.stage)}`,
				ASSET_URL: `https://${getDomainName(props.stage)}`,
				DB_CONNECTION: "pgsql",
				DB_HOST: props.rdsCluster.clusterEndpoint.hostname,
				DB_PORT: props.rdsPort.toString(),
				DB_DATABASE: "izondb",
				DB_USERNAME: "postgres",
				LOG_CHANNEL: "stderr",
				SESSION_DRIVER: "database",
				CACHE_DRIVER: "database",
				QUEUE_CONNECTION: "database",
				FILESYSTEM_DISK: "s3",
				AWS_BUCKET: props.applicationBucket.bucketName,
				AWS_DEFAULT_REGION: cdk.Aws.REGION,
			};
		}
		if (props.stage === "prod") {
			env = {
				APP_NAME: "izon_prod",
				APP_ENV: "production",
				APP_KEY: "base64:0nf03w7jN9tcajSVHcJfQRvgBu8ubydiuNfeYRawDeQ=",
				APP_URL: `https://${getDomainName(props.stage)}`,
				ASSET_URL: `https://${getDomainName(props.stage)}`,
				DB_CONNECTION: "pgsql",
				DB_HOST: props.rdsCluster.clusterEndpoint.hostname,
				DB_PORT: props.rdsPort.toString(),
				DB_DATABASE: "izondb",
				DB_USERNAME: "postgres",
				LOG_CHANNEL: "stderr",
			};
		}

		// RDSのパスワードをシークレットマネージャから取得
		const rdsSecret = props.rdsCluster.secret;
		if (!rdsSecret) {
			throw new Error("RDS secret not found");
		}

		// コンテナをタスク定義に追加
		this.fargateTaskDefinition.addContainer("app", {
			image: ecs.ContainerImage.fromEcrRepository(props.ecrRepository),
			portMappings: [{ containerPort: 80 }],
			healthCheck: {
				command: [
					"CMD-SHELL",
					"curl -f http://localhost:80/healthcheck || exit 1",
				],
				interval: cdk.Duration.seconds(30),
				timeout: cdk.Duration.seconds(5),
				retries: 3,
				startPeriod: cdk.Duration.seconds(10),
			},
			environment: env,
			secrets: {
				DB_PASSWORD: ecs.Secret.fromSecretsManager(rdsSecret, "password"),
			},
			logging: ecs.LogDrivers.awsLogs({
				logGroup,
				streamPrefix: createResourceName(props.stage, "ecs"),
			}),
			command: ["/bin/sh", "/var/www/html/docker/entry-fargate.sh"],
		});

		// アプリケーション用のFargateサービスを作成
		this.service = new ecs.FargateService(this, "service", {
			cluster: this.cluster,
			taskDefinition: this.fargateTaskDefinition,
			desiredCount: props.stage === "prod" ? 2 : 1, // 本番環境では複数タスクを起動
			securityGroups: [props.ecsSg],
			healthCheckGracePeriod: cdk.Duration.seconds(60), // ヘルスチェック猶予期間延長
			enableExecuteCommand: true,
			// サブネット選択：本番環境では複数AZに分散、それ以外は最初のAZのみ
			vpcSubnets:
				props.stage === "prod"
					? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } // 本番環境では全てのプライベートサブネットを使用
					: { subnets: [props.vpc.privateSubnets[0]] }, // 開発/検証環境は最初のAZのプライベートサブネットのみを使用
			deploymentController: {
				type: ecs.DeploymentControllerType.ECS, // ローリングデプロイを明示的に指定
			},
			circuitBreaker: {
				rollback: true, // デプロイ失敗時の自動ロールバックを有効化
			},
		});

		// 本番環境の場合はオートスケーリングを設定
		if (props.stage === "prod") {
			const scalableTarget = this.service.autoScaleTaskCount({
				minCapacity: 2,
				maxCapacity: 4,
			});
			// CPUとメモリの使用率に基づいてスケーリング
			scalableTarget.scaleOnCpuUtilization("CpuScaling", {
				targetUtilizationPercent: 50,
			});

			scalableTarget.scaleOnMemoryUtilization("MemoryScaling", {
				targetUtilizationPercent: 50,
			});
		}

		// ALBからのアクセスを許可
		this.service.connections.allowFrom(
			props.albSg,
			ec2.Port.tcp(80),
			"Allow inbound traffic from ALB",
		);

		// S3バケットへの読み書き権限付与
		props.applicationBucket.grantReadWrite(this.fargateTaskDefinition.taskRole);

		// CloudWatch Logsへの書き込み権限を付与
		logGroup.grantWrite(this.service.taskDefinition.taskRole);

		//#######################################################
		// バッチ処理用のECS定義
		// バッチ処理用のクラスターを作成
		this.batchCluster = new ecs.Cluster(this, "BatchCluster", {
			vpc: props.vpc,
			containerInsightsV2: ecs.ContainerInsights.ENABLED,
		});

		// Fargateタスク定義を作成する
		this.batchTaskDefinition = new ecs.FargateTaskDefinition(
			this,
			"batch-task-definition",
			ecsSpec,
		);

		// InferenceAccelerators警告の解消
		const cfnBatchTaskDef = this.batchTaskDefinition.node
			.defaultChild as ecs.CfnTaskDefinition;
		cfnBatchTaskDef.addDeletionOverride("Properties.InferenceAccelerators");

		// バッチ処理用のロググループを作成
		const batchLogGroup = new logs.LogGroup(this, "batch-log-group", {
			logGroupName: createResourceName(props.stage, "ecs-batch-logs"),
			retention: logs.RetentionDays.ONE_YEAR,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		// サービス作成
		this.batchService = new ecs.FargateService(this, "batchService", {
			cluster: this.batchCluster,
			taskDefinition: this.batchTaskDefinition,
			desiredCount: 0,
			securityGroups: [props.ecsSg],
			healthCheckGracePeriod: cdk.Duration.seconds(60),
			enableExecuteCommand: true,
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
			},
		});
		// バッチコンテナをタスク定義に追加
		this.batchTaskDefinition.addContainer("batch", {
			image: ecs.ContainerImage.fromEcrRepository(props.ecrRepository),
			portMappings: [{ containerPort: 80 }],
			environment: env,
			secrets: {
				DB_PASSWORD: ecs.Secret.fromSecretsManager(rdsSecret, "password"),
			},
			logging: ecs.LogDrivers.awsLogs({
				logGroup: batchLogGroup,
				streamPrefix: createResourceName(props.stage, "batch-task"),
			}),
			// 短時間で終了するタスクでHealthCheckは不整合となる可能性があるため設定しない
		});

		// 本番環境でのみバッチジョブをスケジュール登録
		if (props.stage === "prod") {
			// スケジュールごとのバッチジョブ定義
			const batchJobs = [
				{
					command: "php artisan set:update_master_halls 1",
					schedule: events.Schedule.cron({
						minute: "40",
						hour: "7", // UTC 6:00 = 日本時間 15:00
						day: "*",
						month: "*",
						year: "*",
					}),
					description: "店舗マスタ更新バッチ（オ―アイ）",
				},
				{
					command: "php artisan set:update_master_halls 2",
					schedule: events.Schedule.cron({
						minute: "42",
						hour: "7", // UTC 6:00 = 日本時間 15:00
						day: "*",
						month: "*",
						year: "*",
					}),
					description: "店舗マスタ更新バッチ（グローリー）",
				},
				{
					command: "php artisan set:update_master_halls 3",
					schedule: events.Schedule.cron({
						minute: "44",
						hour: "7", // UTC 6:00 = 日本時間 15:00
						day: "*",
						month: "*",
						year: "*",
					}),
					description: "店舗マスタ更新バッチ（ダイコク）",
				},
				{
					command: "php artisan set:update_master_halls 4",
					schedule: events.Schedule.cron({
						minute: "46",
						hour: "7", // UTC 6:00 = 日本時間 15:00
						day: "*",
						month: "*",
						year: "*",
					}),
					description: "店舗マスタ更新バッチ（大都）",
				},
				{
					command: "php artisan set:update_master_halls 5",
					schedule: events.Schedule.cron({
						minute: "48",
						hour: "7", // UTC 6:00 = 日本時間 15:00
						day: "*",
						month: "*",
						year: "*",
					}),
					description: "店舗マスタ更新バッチ（マース）",
				},
				{
					command: "php artisan set:update_master_halls 6",
					schedule: events.Schedule.cron({
						minute: "50",
						hour: "7", // UTC 6:00 = 日本時間 15:00
						day: "*",
						month: "*",
						year: "*",
					}),
					description: "店舗マスタ更新バッチ（J-NET）",
				},
			];

			// バッチジョブをスケジュールに登録;
			batchJobs.forEach((job, index) => {
				const rule = new events.Rule(
					this,
					`scheduled-batch-${index + 1}-eventbridge-rule`,
					{
						schedule: job.schedule,
						description: job.description,
						ruleName: createResourceName(
							props.stage,
							`scheduled-batch-${index + 1}-rule`,
						),
					},
				);

				rule.addTarget(
					new eventsTargets.EcsTask({
						cluster: this.batchCluster,
						taskDefinition: this.batchTaskDefinition,
						taskCount: 1,
						subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
						securityGroups: [props.ecsSg],
						containerOverrides: [
							{
								containerName: "batch",
								command: job.command.split(" "),
							},
						],
					}),
				);
			});

			// バッチ処理用のタスク定義更新ジョブ - 開始ルール (8:30 AM JST)
			new events.Rule(this, "batch-service-start-eventbridge-rule", {
				description:
					"バッチ処理サービスを8:30 AM JSTに開始するスケジュールルール",
				ruleName: createResourceName(props.stage, "batch-service-start-rule"),
				schedule: events.Schedule.cron({
					minute: "30",
					hour: "23",
				}),
				targets: [
					new eventsTargets.AwsApi({
						service: "ECS",
						action: "updateService",
						parameters: {
							cluster: this.batchCluster.clusterName,
							service: this.batchService.serviceName,
							desiredCount: 1,
						},
						policyStatement: new iam.PolicyStatement({
							actions: ["ecs:UpdateService"],
							resources: [this.batchService.serviceArn],
						}),
					}),
				],
			});

			// バッチ処理用のタスク定義更新ジョブ - 停止ルール (8:00 PM JST)
			new events.Rule(this, "batch-service-stop-eventbridge-rule", {
				description:
					"バッチ処理サービスを8:00 PM JSTに停止するスケジュールルール",
				ruleName: createResourceName(props.stage, "batch-service-stop-rule"),
				schedule: events.Schedule.cron({
					minute: "0",
					hour: "11",
				}),
				targets: [
					new eventsTargets.AwsApi({
						service: "ECS",
						action: "updateService",
						parameters: {
							cluster: this.batchCluster.clusterName,
							service: this.batchService.serviceName,
							desiredCount: 0,
						},
						policyStatement: new iam.PolicyStatement({
							actions: ["ecs:UpdateService"],
							resources: [this.batchService.serviceArn],
						}),
					}),
				],
			});
		}

		// ログ書き込み権限の付与
		batchLogGroup.grantWrite(this.batchService.taskDefinition.taskRole);
	}

	/**
	 * 環境とサービスタイプに応じたECSタスク仕様を取得
	 * @param stage 環境（local, dev, prod）
	 * @returns ECSタスク仕様
	 */
	private getTaskSpecificationForStage(stage: Stage): EcsTaskSpecification {
		// 基本スペック定義
		const specs: Record<string, Record<string, EcsTaskSpecification>> = {
			prod: {
				spec: {
					memoryLimitMiB: 2048,
					cpu: 512,
				},
			},
			dev: {
				spec: {
					memoryLimitMiB: 512,
					cpu: 256,
				},
			},
			local: {
				spec: {
					memoryLimitMiB: 512,
					cpu: 256,
				},
			},
		};
		return specs[stage].spec;
	}
}