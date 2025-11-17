import { Stack, StackProps, Stage } from "aws-cdk-lib";
import { Scope } from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";
import { HostedZone } from "./construct/hostedZone";

interface ECSStackProps extends StackProps{
    stage: Stage;
}

//ECS stack
class ECSStack  extends  Stack{
    constructor(scope:Construct,id:string,props:ECSStackProps){
        super(scope,id,props)

        const hostedZone= new HostedZone(this,"myhostedZone",{
            stage: props.stage,
        })
    }

}