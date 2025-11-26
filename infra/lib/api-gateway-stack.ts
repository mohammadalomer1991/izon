import { Duration, Stack, Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2  from 'aws-cdk-lib/aws-ec2';
import  * as rds from 'aws-cdk-lib/aws-rds';
interface ApiGateWayStackProps{
    stage:Stage;
    vpc:ec2.Vpc;
    apiEcsSg:ec2.SecurityGroup;
    rdsCluster:rds.DatabaseCluster;
    dbCredentialsSecret:rds.DatabaseSecret;
    rdsSg:ec2.SecurityGroup

}
class ApiGateWayStack extends  Stack{

    private role:iam.Role
    private myGateway:apigateway.CfnAccount
    constructor(scope:Construct,id:string,props:ApiGateWayStackProps){
        super(scope,id);
    
        this.role = new iam.Role(this, "ApiGatewayLogsRole", {
            roleName: "api-gateway-logs-role",
            assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    "service-role/AmazonAPIGatewayPushToCloudWatchLogs",
                ),
            ],
            maxSessionDuration: Duration.hours(1),


        });

        this.myGateway= new apigateway.CfnAccount(this,"ApiGateway",
            {
                cloudWatchRoleArn:this.role.roleArn
            });
        
        const apiApplicationBucketArn=ssm.StringParameter.valueForStringParameter(
            this,"api-application-bucket-arn",
        )

        const apiApplicationBucket = s3.Bucket.fromBucketArn(
			this,
			"api-application-bucket",
			apiApplicationBucketArn,
		);

        const apiEcrRepositoryName = ssm.StringParameter.valueForStringParameter(
			this,
			"api-repository-name",
		);

        const apiEcrRepository = ecr.Repository.fromRepositoryName(
			this,
			"api-repository",
			apiEcrRepositoryName,
		);

        const { vpc, apiEcsSg, rdsCluster, dbCredentialsSecret, rdsSg } = props;



    }//end of constructor

 // create a new  gateway
}