
import * as route53 from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs';
import * as certificate from 'aws-cdk-lib/aws-certificatemanager'
import { Stage } from 'aws-cdk-lib';

interface HostedZoneProps{
    stage:Stage
}

export class HostedZone extends Construct{
    public hostedZone:route53.IHostedZone;
    public certificate:certificate.Certificate
    constructor(scope:Construct,id:string,props:HostedZoneProps){
        super(scope,id)
    

    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        "hosted-zone",
        {
            zoneName: "domainName",
            hostedZoneId: "getHostZoneId(props.stage)",
        },
    );

    this.certificate=new certificate.Certificate(this,"www",{
        domainName:""
    })
}
}