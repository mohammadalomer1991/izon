import { Stack } from "aws-cdk-lib";
import { Scope } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";
import * as iam from 'aws-cdk-lib/aws-iam'

import * as apigateway from 'aws-cdk-lib/aws-apigateway'

interface APIGateWayStackProps {

}

class APIGateWayStack extends  Stack{
    public my_api_gateway:apigateway.CfnAccount;
    private my_role:iam.Role;
    constructor(scope:Construct,id:string, props:APIGateWayStackProps){
        super(scope,id,props)
    
    this.my_role=new iam.Role(this,"my_role", {
        roleName:"my_role",
        assumedBy:
        manager
    })
    this.my_api_gateway= new apigateway.CfnAccount(this,"mygateway",{
        cloudWatchRoleArn:this.my_role.roleArn

    });
}
}