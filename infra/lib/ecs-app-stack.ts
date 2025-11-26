import { Stack, Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import  * as  ec2 from 'aws-cdk-lib/aws-ec2'
import * as  rds  from 'aws-cdk-lib/aws-rds'
import { HostedZone } from "./construct/hostedZone";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm'
import  * as ecr from 'aws-cdk-lib/aws-ecr'

interface EcsAppStackProps{
    stage:Stage;
    vpc:ec2.Vpc;
    rds:rds.DatabaseCluster;
    albSg:ec2.SecurityGroup;
    ecsSg:ec2.SecurityGroup;
    cloudFlareSg:ec2.SecurityGroup;
    lambdaSg:ec2.SecurityGroup
}

export class EcsAppStack extends Stack{

    

    constructor(scope:Construct,id:string, props:EcsAppStackProps){
        super(scope,id)
    
    const hostedZone = new  HostedZone(this,"",{name:"",stage:props.stage});

    const {vpc}=props


    //Write the command to get application bucket arn
    const applicationBUcketArn=ssm.StringParameter.valueForStringParameter(this,"")

    const  myBucket = s3.Bucket.fromBucketArn(this,"",applicationBUcketArn)
    
    // create Amazon ECR repository knowing that the repositroy name is in ssm.parameter store
    
    const repo_name=ssm.StringParameter.fromStringParameterName(this,"resource_name","repository_name");

        // ECS 定義
        // EKS
        // Amazon Fargate

    }

    
    
}