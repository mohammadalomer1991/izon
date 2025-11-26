import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr  from 'aws-cdk-lib/aws-ecr';
import * as cdk from 'aws-cdk-lib'
export class ResourceStoreStack extends Stack{
    constructor(scope:Construct,id:string,){
        super(scope,id)
    
        const repository= new ecr.Repository(this,"my-repositroy",{
            repositoryName:  "repository",
				removalPolicy: cdk.RemovalPolicy.DESTROY,
				emptyOnDelete: true,
				imageScanOnPush: true,
        });
    }
}