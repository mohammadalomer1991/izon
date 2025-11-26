import { Construct } from "constructs";
import  * as route53 from 'aws-cdk-lib/aws-route53'
import { CreateResourceName } from "../../utils/create-resorce-name";
import { Stage } from "aws-cdk-lib";
import  * as acm  from 'aws-cdk-lib/aws-certificatemanager'

interface HostedZoneProps{
    name:string;
    stage:Stage
}
export class HostedZone extends Construct{
    public readonly hostedZone:route53.IHostedZone
    public readonly certificate:acm.ICertificate
    constructor(scope:Construct, id:string,props:HostedZoneProps){
        super(scope,id);
        
        this.hostedZone= route53.HostedZone.fromHostedZoneAttributes(this,CreateResourceName(props.stage,"my_hostedZone"),{
            hostedZoneId:"a",
            zoneName:""

        })

        this.certificate= new  acm.Certificate(this,"",{
            domainName:""
        })
    }

}