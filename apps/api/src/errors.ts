export class ApiFailure extends Error{
 constructor(public readonly status:number,public readonly code:string,message:string,public readonly details?:Record<string,unknown>){super(message)}
}
export function fail(status:number,code:string,message:string,details?:Record<string,unknown>):never{
 throw new ApiFailure(status,code,message,details);
}
