import { Stack, StackProps, Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cw from 'aws-cdk-lib/aws-cloudwatch'

interface MetricsStackProps extends StackProps{
    metrics_name:string
    stage:string // dev,prod
}

export class MetricsStack extends Stack{
    constructor(scope:Construct,id:string, props:MetricsStackProps){
        super(scope,id,props)
        const dashbaord:cw.Dashboard
        if (props.stage=='dev'){
            dashbaord= new cw.Dashboard(this,'mydash');

        }
    }
}